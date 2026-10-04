// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// The edge-case pass of 2026-10-04: what happens to a session, an editor and a live game
// when time passes, the network drops, or somebody does the ordinary thing in an unusual
// order. Every test here failed before its fix. Findings E1 to E10 are in
// docs/edge-cases-2026-10.md.

import { readFileSync } from 'node:fs';
import { connect as tcp } from 'node:net';
import { resolve } from 'node:path';
import { expect, test, type Page, type WebSocketRoute } from '@playwright/test';
import { SignJWT } from 'jose';
import { apiLogin, PASSWORD, registerUser, signedInContext } from './accounts';
import {
	gotoPlayHydrated,
	hostFromViewPage,
	mc,
	PHONE,
	rememberAnonQuiz,
	saveQuiz,
	titleBox
} from './helpers';
import { closeAll, connect, hostGame, joinAll, next, showQuestion, startGame } from './sockets';

const QUIZ = {
	title: 'Edge cases',
	description: 'e2e',
	questions: [
		mc(
			'Capital of Portugal?',
			[
				['Lisbon', true],
				['Porto', false]
			],
			'60'
		),
		mc(
			'Capital of Spain?',
			[
				['Madrid', true],
				['Bilbao', false]
			],
			'60'
		)
	]
};

test.afterEach(closeAll);

// The stack's own key, so a test can mint the token a browser would hold half an hour on.
const SECRET_KEY = readFileSync(resolve(process.cwd(), '..', 'e2e', 'e2e.env'), 'utf8').match(
	/^SECRET_KEY=(.+)$/m
)![1];

const expiredToken = (email: string) =>
	new SignJWT({ sub: email, jti: crypto.randomUUID().replace(/-/g, '') })
		.setProtectedHeader({ alg: 'HS256' })
		.setExpirationTime(Math.floor(Date.now() / 1000) - 60)
		.sign(new TextEncoder().encode(SECRET_KEY));

// The stack's Redis (fakeredis, REDIS in e2e/e2e.env). A key that expired is a key that is
// gone, so deleting one is an hour passing.
const expire = (key: string) =>
	new Promise<void>((done, fail) => {
		const s = tcp(6380, '127.0.0.1', () =>
			s.write(['*2', '$3', 'DEL', `$${Buffer.byteLength(key)}`, key, ''].join('\r\n'))
		);
		s.once('data', (reply) => {
			s.end();
			if (reply.toString() === ':1\r\n') done();
			else fail(new Error(`DEL ${key}: ${reply}`));
		});
		s.once('error', fail);
	});

test.describe('sessions', () => {
	// E1. The access token lasts 30 minutes and is renewed from rememberme_token, but only
	// when the expired token is still sent. The cookie carrying it was cut to 30 minutes
	// too, so it vanished with the token and nothing renewed it: everyone was signed out
	// half an hour after logging in, and an open editor started failing every save.
	test('a session outlives its 30-minute access token', async ({ browser, request }) => {
		const { email } = await registerUser(request, 'edge');
		const ctx = await browser.newContext();
		await apiLogin(ctx.request, email);
		const access = (await ctx.cookies()).find((c) => c.name === 'access_token')!;
		expect(access.expires - Date.now() / 1000, 'access cookie lifetime').toBeGreaterThan(
			86_400
		);

		// What the browser holds after half an hour: the same cookie, an expired token.
		await ctx.addCookies([
			{
				...access,
				value: access.value.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/, await expiredToken(email))
			}
		]);
		expect((await ctx.request.get('/api/v1/users/me')).status()).toBe(200);
		const page = await ctx.newPage();
		await page.goto('/account/settings');
		await expect(page).toHaveURL(/\/account\/settings$/);
		await ctx.close();
	});

	// E3. Registration stores the address folded to lower case; login compared it exactly,
	// so "Ana@Frog.co" registered fine and then got "wrong credentials" typed the same way.
	test('an address registered with capitals logs in as typed', async ({ request }) => {
		const username = `Edge${Date.now().toString(36)}`;
		const email = `${username}@Example.com`;
		const created = await request.post('/api/v1/users/create', {
			data: { email, username, password: PASSWORD }
		});
		expect(created.status(), await created.text()).toBe(200);
		for (const typed of [email, email.toUpperCase(), ` ${email.toLowerCase()} `]) {
			const start = await request.post('/api/v1/login/start', { data: { email: typed } });
			const { session_id } = await start.json();
			const step = await request.post(`/api/v1/login/step/1?session_id=${session_id}`, {
				data: { auth_type: 'PASSWORD', data: PASSWORD }
			});
			expect(step.status(), `log in as ${JSON.stringify(typed)}`).toBe(200);
		}
	});
});

test.describe('editor', () => {
	// E2. An edit session lives an hour from its last save. An editor left open over lunch
	// then failed every save with "401: Edit ID not found!" until the page was reloaded,
	// which threw away whatever had been typed since.
	test('the editor keeps saving after its edit session lapses', async ({ browser, request }) => {
		const { context, page } = await signedInContext(browser, request);
		const saved = await saveQuiz(context.request, QUIZ);
		const id = saved.body.id as string;
		const started = page.waitForResponse((r) => r.url().includes('/api/v1/editor/start'));
		await page.goto(`/edit?quiz_id=${id}`);
		const { token } = await (await started).json();
		await expect(titleBox(page)).toBeVisible();

		await expire(`edit_session:${token}`);

		await titleBox(page).fill('After the session lapsed');
		await expect
			.poll(
				async () =>
					(await (await context.request.get(`/api/v1/quiz/get/${id}`)).json()).title,
				{
					timeout: 15_000
				}
			)
			.toBe('After the session lapsed');
		await expect(page.getByRole('alert')).toHaveCount(0);
		await context.close();
	});

	// E14. The leave prompt only covers closing the tab. Going back inside the app unmounted
	// the editor, and unmounting cleared the pending autosave: whatever was typed in the
	// last couple of seconds was dropped without a word.
	test('going back straight after typing keeps what was typed', async ({ browser, request }) => {
		const { context, page } = await signedInContext(browser, request);
		const saved = await saveQuiz(context.request, QUIZ);
		const id = saved.body.id as string;
		await page.goto(`/view/${id}`);
		await page.getByRole('link', { name: 'Edit' }).click();
		await expect(titleBox(page)).toBeVisible();
		await page.waitForTimeout(3000); // past the first, no-op save

		await titleBox(page).fill('Typed just before going back');
		await page.goBack();
		await expect(page).toHaveURL(new RegExp(`/view/${id}$`));
		await expect
			.poll(
				async () =>
					(await (await context.request.get(`/api/v1/quiz/get/${id}`)).json()).title,
				{
					timeout: 10_000
				}
			)
			.toBe('Typed just before going back');
		await context.close();
	});

	// E15. A save that failed for want of a network stayed failed until the next keystroke:
	// the connection came back, the header stayed red, and nothing was sent.
	test('a save that failed offline goes through when the network returns', async ({
		browser,
		request
	}) => {
		const { context, page } = await signedInContext(browser, request);
		const saved = await saveQuiz(context.request, QUIZ);
		const id = saved.body.id as string;
		await page.goto(`/edit?quiz_id=${id}`);
		await expect(titleBox(page)).toBeVisible();
		await page.waitForTimeout(3000); // past the first, no-op save

		await context.setOffline(true);
		await titleBox(page).fill('Typed on the train');
		await expect(page.getByRole('alert')).toContainText('could not be reached', {
			timeout: 10_000
		});
		await context.setOffline(false);
		await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 10_000 });
		const now = await (await context.request.get(`/api/v1/quiz/get/${id}`)).json();
		expect(now.title).toBe('Typed on the train');
		await context.close();
	});

	// E8. A save sends the whole quiz. A tab opened before another device saved went on to
	// write its older copy over the newer one the moment somebody typed in it.
	test('a tab that is behind cannot overwrite a newer save', async ({ browser, request }) => {
		const { context, page } = await signedInContext(browser, request);
		const saved = await saveQuiz(context.request, QUIZ);
		const id = saved.body.id as string;
		await page.goto(`/edit?quiz_id=${id}`);
		await expect(titleBox(page)).toBeVisible();

		const other = await context.request.post(`/api/v1/editor/start?edit=true&quiz_id=${id}`);
		const { token } = await other.json();
		const res = await context.request.post(`/api/v1/editor/save?edit_id=${token}`, {
			data: { public: false, ...QUIZ, title: 'Saved on the phone' }
		});
		expect(res.status(), await res.text()).toBe(200);

		await titleBox(page).fill('Typed on the laptop');
		await expect(page.getByRole('alert')).toContainText('changed', { timeout: 15_000 });
		const now = await (await context.request.get(`/api/v1/quiz/get/${id}`)).json();
		expect(now.title).toBe('Saved on the phone');
		await context.close();
	});
});

test.describe('live game, protocol', () => {
	// E4. "Everyone answered" compared the number of answers with the number of players
	// still connected. An answer from somebody who had since dropped still counted, so a
	// locked phone could end the question on a player who was still choosing.
	test('a player who answered and then dropped does not end the question for the rest', async ({
		request
	}) => {
		const { host, pin } = await hostGame(request, QUIZ);
		const [early, second, last] = await joinAll(pin, ['early', 'second', 'last']);
		await startGame(host);
		await showQuestion(host, 0);

		const counted = next(host, 'player_answer');
		early.emit('submit_answer', { question_index: 0, answer: 'Lisbon' });
		expect(await counted).not.toBeNull();
		early.close();
		await new Promise((r) => setTimeout(r, 500));

		const tooSoon = next(host, 'everyone_answered', 2000);
		second.emit('submit_answer', { question_index: 0, answer: 'Lisbon' });
		expect(await tooSoon, 'question ended with "last" still to answer').toBeNull();

		const ended = next(host, 'everyone_answered');
		last.emit('submit_answer', { question_index: 0, answer: 'Lisbon' });
		expect(await ended, 'question ended once everyone here answered').not.toBeNull();
	});

	// E5. A player who reloads or reconnects mid-question is sent the question again, and
	// the phone's countdown used to start from the full time. The server keeps the real
	// one, so a tap the phone still allowed came back "time is up".
	test('a player who comes back mid-question is given the time that is left', async ({
		request
	}) => {
		const { host, pin } = await hostGame(request, QUIZ);
		const [player] = await joinAll(pin, ['returner']);
		await startGame(host);
		await showQuestion(host, 0);
		await new Promise((r) => setTimeout(r, 3000));

		const back = await connect();
		const question = next<{ question: { time: string } }>(back, 'set_question_number');
		back.emit('rejoin_game', { old_sid: player.id, username: 'returner', game_pin: pin });
		const time = Number((await question)?.question.time);
		expect(time).toBeLessThanOrEqual(57);
		expect(time).toBeGreaterThanOrEqual(55);
	});

	// E7. The same resend went to a player who had already answered, so a phone woken from
	// sleep swapped "Answer locked in" for the tiles again, inviting a second answer the
	// server would refuse.
	test('a player who already answered is not handed the question again', async ({ request }) => {
		const { host, pin } = await hostGame(request, QUIZ);
		const [player, other] = await joinAll(pin, ['answered', 'other']);
		await startGame(host);
		await showQuestion(host, 0);
		const counted = next(host, 'player_answer');
		player.emit('submit_answer', { question_index: 0, answer: 'Lisbon' });
		expect(await counted).not.toBeNull();

		const back = await connect();
		const rejoined = next(back, 'rejoined_game');
		const question = next(back, 'set_question_number', 1500);
		back.emit('rejoin_game', { old_sid: player.id, username: 'answered', game_pin: pin });
		expect(await rejoined).not.toBeNull();
		expect(await question, 'question sent again').toBeNull();
		other.close();
	});
});

test.describe('live game, in the browser', () => {
	async function hostQuiz(browser, request) {
		const saved = await saveQuiz(request, QUIZ);
		const hostCtx = await browser.newContext();
		const host = await hostCtx.newPage();
		await rememberAnonQuiz(host, saved.body.id, saved.secret!);
		return { hostCtx, host, pin: await hostFromViewPage(host, saved.body.id) };
	}

	async function showFirstQuestion(host: Page) {
		await host
			.getByRole('button', { name: /Start game/ })
			.first()
			.click();
		await host.waitForTimeout(800);
		await host
			.getByRole('button', { name: /Next question/ })
			.first()
			.click();
	}

	// E6. /play kept its socket when the app navigated away, so a back swipe mid-game left
	// the player connected and counted but with no screen to answer on, and coming forward
	// again showed an empty join form with their own nickname taken.
	test('a back swipe out of a game and forward again keeps the player in it', async ({
		browser,
		request
	}) => {
		test.setTimeout(2 * 60_000);
		const { hostCtx, host, pin } = await hostQuiz(browser, request);
		const ctx = await browser.newContext({ viewport: PHONE });
		const player = await ctx.newPage();
		await player.goto('/');
		await player.waitForLoadState('networkidle');
		const connected = player.waitForEvent('console', (m) => m.text() === 'Connected!');
		await player.getByRole('button', { name: 'Open menu' }).click();
		await player.getByRole('dialog').getByRole('link', { name: 'Join' }).click();
		await player.waitForURL(/\/play$/);
		await connected;
		await player.getByRole('textbox', { name: 'Game PIN' }).fill(pin);
		await player.getByRole('textbox', { name: 'Username' }).fill('swiper');
		await player.getByRole('button', { name: 'Join game' }).click();
		await expect(host.getByText('swiper')).toBeVisible();
		await showFirstQuestion(host);
		await expect(player.getByRole('button', { name: 'Lisbon' })).toBeVisible();

		await player.goBack();
		await expect(player).toHaveURL(/\/$/);
		await player.goForward();
		await expect(player.getByRole('button', { name: 'Lisbon' })).toBeVisible({
			timeout: 10_000
		});
		await player.getByRole('button', { name: 'Lisbon' }).click();
		// The only player answered, so the question ends well before its 60 seconds.
		await expect(host.getByRole('button', { name: /Show results/ })).toBeVisible({
			timeout: 10_000
		});
		await ctx.close();
		await hostCtx.close();
	});

	// Held up when probed: a player whose connection drops and comes back without a reload
	// is rejoined from the joined_game cookie and can still answer. Kept as a guard.
	test('a player whose connection drops mid-question can still answer', async ({
		browser,
		request
	}) => {
		test.setTimeout(2 * 60_000);
		const { hostCtx, host, pin } = await hostQuiz(browser, request);
		const ctx = await browser.newContext({ viewport: PHONE });
		const player = await ctx.newPage();
		const sockets: WebSocketRoute[] = [];
		await player.routeWebSocket(/socket\.io/, (ws) => {
			ws.connectToServer();
			sockets.push(ws);
		});
		await gotoPlayHydrated(player);
		await player.getByRole('textbox', { name: 'Game PIN' }).fill(pin);
		await player.getByRole('textbox', { name: 'Username' }).fill('dropper');
		await player.getByRole('button', { name: 'Join game' }).click();
		await expect(host.getByText('dropper')).toBeVisible();
		await showFirstQuestion(host);
		await expect(player.getByRole('button', { name: 'Lisbon' })).toBeVisible();

		const reconnected = player.waitForEvent('console', (m) => m.text() === 'Connected!');
		await sockets.at(-1)!.close({ code: 4000, reason: 'wifi dropped' });
		await reconnected;
		await player.getByRole('button', { name: 'Lisbon' }).click();
		await expect(host.getByRole('button', { name: /Show results/ })).toBeVisible({
			timeout: 10_000
		});
		await ctx.close();
		await hostCtx.close();
	});

	// Probed: the host's connection drops mid-question and a player answers while it is
	// gone. The host re-registers on reconnect; this checks it still learns the question
	// is over.
	test('a host whose connection drops still sees the question end', async ({
		browser,
		request
	}) => {
		test.setTimeout(2 * 60_000);
		const saved = await saveQuiz(request, QUIZ);
		const hostCtx = await browser.newContext();
		const host = await hostCtx.newPage();
		await rememberAnonQuiz(host, saved.body.id, saved.secret!);
		const sockets: WebSocketRoute[] = [];
		await host.routeWebSocket(/socket\.io/, (ws) => {
			ws.connectToServer();
			sockets.push(ws);
		});
		const pin = await hostFromViewPage(host, saved.body.id);
		const ctx = await browser.newContext({ viewport: PHONE });
		const player = await ctx.newPage();
		await gotoPlayHydrated(player);
		await player.getByRole('textbox', { name: 'Game PIN' }).fill(pin);
		await player.getByRole('textbox', { name: 'Username' }).fill('steady');
		await player.getByRole('button', { name: 'Join game' }).click();
		await expect(host.getByText('steady')).toBeVisible();
		await showFirstQuestion(host);
		await expect(player.getByRole('button', { name: 'Lisbon' })).toBeVisible();

		const before = sockets.length;
		await sockets.at(-1)!.close({ code: 4000, reason: 'wifi dropped' });
		await player.getByRole('button', { name: 'Lisbon' }).click();
		await expect.poll(() => sockets.length).toBeGreaterThan(before);
		await expect(host.getByRole('button', { name: /Show results/ })).toBeVisible({
			timeout: 10_000
		});
		await ctx.close();
		await hostCtx.close();
	});

	// E10. The PIN box had maxlength 6, so "123 456" pasted from a chat message was cut to
	// "123 45" before the non-digits were stripped, leaving five digits and no way on.
	test('a PIN pasted with a space in it still joins', async ({ browser, request }) => {
		const { pin } = await hostGame(request, QUIZ);
		const ctx = await browser.newContext({ viewport: PHONE });
		const player = await ctx.newPage();
		await gotoPlayHydrated(player);
		await player.getByRole('textbox', { name: 'Game PIN' }).focus();
		await player.keyboard.insertText(`${pin.slice(0, 3)} ${pin.slice(3)}`);
		await expect(player.getByRole('textbox', { name: 'Username' })).toBeVisible();

		await player.goto('/');
		const home = player.getByRole('textbox', { name: 'Game PIN' });
		await home.focus();
		await player.keyboard.insertText(`${pin.slice(0, 3)} ${pin.slice(3)}`);
		await player.getByRole('button', { name: 'Join', exact: true }).click();
		await expect(player).toHaveURL(new RegExp(`/play\\?pin=${pin}$`));
		await ctx.close();
	});
});
