// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// The visual review's capture (docs/visual-review-v1.md, docs/v1-plan.md). Every visible
// screen at 390, 834 and 1440 in light and dark, the dialogs that hide actions, and a
// whole game on the host's projector and a player's phone. Skipped unless VISUAL=1, so the
// normal run is unchanged:
//
//   VISUAL=1 bash e2e/run.sh e2e/visual.e2e.ts
//   VISUAL=1 VISUAL_LABEL=step-3 bash e2e/run.sh e2e/visual.e2e.ts
//
// Shots and manifest.jsonl land in e2e/.visual/<label>/, which is git-ignored. Every
// shot is checked for the three things CLAUDE.md says have regressed before (the `.dark`
// class, horizontal overflow, the token background on <html>) and run through axe. The
// checks are soft, so one bad screen does not stop the rest from being captured; the run
// still fails if any of them did.
//
// Dark mode had never been exercised by a spec: app.html reads localStorage.theme, or
// prefers-color-scheme when there is none, before first paint. Both are set here.

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { apiLogin, registerUser } from './accounts';
import {
	advanceToFinalResults,
	clearScoreboardStep,
	gotoPlayHydrated,
	hostFromViewPage,
	mc,
	PHONE,
	rememberAnonQuiz,
	saveQuiz,
	showResults,
	titleBox,
	type QuizInput
} from './helpers';
import { closeAll, liveGame } from './sockets';

test.skip(process.env.VISUAL !== '1', 'visual capture runs only with VISUAL=1');
// A step that cannot happen fails in 15 s rather than holding the run to its 30-minute limit.
test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

const LABEL = process.env.VISUAL_LABEL ?? 'latest';
// Not under e2e/.data: run.sh wipes that at the start of every run, shots included.
const OUT = path.join(import.meta.dirname, '..', '..', 'e2e', '.visual', LABEL);
const SIZES = [
	{ width: 390, height: 844 },
	{ width: 834, height: 1112 },
	{ width: 1440, height: 900 }
];
const PROJECTOR = { width: 1920, height: 1080 };
const THEMES = ['light', 'dark'] as const;
type Theme = (typeof THEMES)[number];

type Shot = {
	name: string;
	theme: Theme;
	width: number;
	height: number;
	url: string;
	file: string;
	dark: boolean;
	overflow: number;
	background: string;
	axe: { id: string; impact: string | null | undefined; nodes: number }[];
};

test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

async function themedContext(
	browser: Browser,
	theme: Theme,
	viewport: { width: number; height: number },
	storageState?: string
): Promise<BrowserContext> {
	const context = await browser.newContext({
		viewport,
		colorScheme: theme,
		// Motion off, so a shot is the settled screen and not a frame of its entrance.
		reducedMotion: 'reduce',
		storageState
	});
	await context.addInitScript((t) => {
		try {
			localStorage.setItem('theme', t);
		} catch {
			/* a page with no storage still gets the media query */
		}
	}, theme);
	return context;
}

/** One screen: its checks, its axe report and a full-page shot. */
async function capture(page: Page, name: string, theme: Theme) {
	await page.waitForLoadState('networkidle').catch(() => undefined);
	await page.waitForTimeout(400);
	const viewport = page.viewportSize() ?? { width: 0, height: 0 };
	const state = await page.evaluate(() => ({
		dark: document.documentElement.classList.contains('dark'),
		overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
		background: getComputedStyle(document.documentElement).backgroundColor
	}));
	const axe = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
		.analyze()
		.then((r) =>
			r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))
		)
		.catch(() => [{ id: 'axe-did-not-run', impact: null, nodes: 0 }]);
	const file = `${name}__${viewport.width}__${theme}.png`;
	await page.screenshot({ path: path.join(OUT, file), fullPage: true });
	// One line per shot, appended as it is taken: a failed test restarts the worker, which
	// wiped an in-memory list and lost every shot taken before it.
	const shot: Shot = { name, theme, ...viewport, url: page.url(), file, ...state, axe };
	fs.appendFileSync(path.join(OUT, 'manifest.jsonl'), JSON.stringify(shot) + '\n');

	const where = `${name} at ${viewport.width} in ${theme}`;
	expect.soft(state.dark, `${where}: .dark`).toBe(theme === 'dark');
	expect.soft(state.overflow, `${where}: horizontal overflow`).toBeLessThanOrEqual(0);
	expect.soft(state.background, `${where}: <html> background`).not.toBe('rgba(0, 0, 0, 0)');
	expect.soft(axe, `${where}: axe ${axe.map((a) => a.id).join(', ')}`).toEqual([]);
}

const QUIZ: QuizInput = {
	title: 'Frogs of the world',
	description: 'A short quiz about frogs, for the visual review.',
	questions: [
		mc('Which of these frogs is the largest?', [
			['Goliath frog', true],
			['Poison dart frog', false],
			['Glass frog', false],
			['Tree frog', false]
		]),
		{
			question: 'Which of these are amphibians?',
			time: '20',
			type: 'CHECK',
			answers: [
				{ answer: 'Frog', right: true },
				{ answer: 'Salamander', right: true },
				{ answer: 'Lizard', right: false },
				{ answer: 'Turtle', right: false }
			]
		},
		mc('Where do tadpoles live?', [
			['Water', true],
			['Trees', false]
		])
	]
};

test.describe('every screen', () => {
	test.setTimeout(30 * 60_000);

	test('signed out', async ({ browser, request }) => {
		const saved = await saveQuiz(request, QUIZ);
		expect(saved.status).toBe(200);
		const id = saved.body.id as string;
		for (const theme of THEMES) {
			for (const size of SIZES) {
				const context = await themedContext(browser, theme, size);
				const page = await context.newPage();
				const routes: [string, string][] = [
					['home', '/'],
					['play', '/play'],
					['login', '/account/login'],
					['my-quizzes-empty', '/my-quizzes'],
					['view-visitor', `/view/${id}`],
					['practice', `/practice?quiz_id=${id}`],
					['tos', '/docs/tos'],
					['privacy', '/docs/privacy-policy'],
					['attribution', '/docs/attribution'],
					['oauth-error', '/account/oauth-error'],
					['not-found', '/no-such-page']
				];
				for (const [name, url] of routes) {
					await page.goto(url);
					await capture(page, name, theme);
				}
				// The menu button is `md:hidden` (768). This said 1024, so at 834 it waited for a
				// button that is not there, and the loop never reached 1440 or the dark theme.
				if (size.width < 768) {
					// The navbar, and so its menu, is hidden on the game and editor routes.
					await page.goto('/my-quizzes');
					// Clicked before hydration, the button does nothing.
					await page.waitForLoadState('networkidle');
					await page.getByRole('button', { name: 'Open menu' }).click();
					await expect(page.getByRole('dialog')).toBeVisible();
					await capture(page, 'menu-drawer', theme);
				}
				// The owner's view of an anonymous quiz, from the browser that made it.
				await rememberAnonQuiz(page, id, saved.secret!);
				await page.goto(`/view/${id}`);
				await capture(page, 'view-anon-owner', theme);
				await page.goto('/create');
				await capture(page, 'create', theme);
				await context.close();
			}
		}
	});

	test('signed in', async ({ browser }) => {
		const user = await registerUser();
		const login = await browser.newContext();
		await apiLogin(login.request, user.email);
		const owned = await saveQuiz(login.request, { ...QUIZ, public: true });
		expect(owned.status).toBe(200);
		const id = owned.body.id as string;
		const state = path.join(OUT, '.signed-in.json');
		await login.storageState({ path: state });
		await login.close();

		for (const theme of THEMES) {
			for (const size of SIZES) {
				const context = await themedContext(browser, theme, size, state);
				const page = await context.newPage();
				const routes: [string, string][] = [
					['my-quizzes', '/my-quizzes'],
					['explore', '/explore'],
					['explore-search', '/explore?q=frogs'],
					['settings', '/account/settings'],
					['view-owner', `/view/${id}`]
				];
				for (const [name, url] of routes) {
					await page.goto(url);
					await capture(page, name, theme);
				}

				await page.goto(`/view/${id}`);
				await page.waitForLoadState('networkidle');
				await page.getByRole('button', { name: 'Play', exact: true }).click();
				await expect(page.getByRole('dialog', { name: 'Start game' })).toBeVisible();
				await capture(page, 'dialog-start-game', theme);
				await page.keyboard.press('Escape');

				await page.getByRole('button', { name: 'Download' }).click();
				await expect(page.getByRole('dialog')).toBeVisible();
				await capture(page, 'dialog-download', theme);
				await page.keyboard.press('Escape');

				await page.goto(`/edit?quiz_id=${id}`);
				await page.locator('[data-question-card]').first().click();
				await capture(page, 'editor', theme);
				await context.close();
			}
		}
		fs.rmSync(state, { force: true });
	});
});

// The editor's states from step 3a (#35): a save that lost to another device, the offer to
// restore what was typed, a quiz deleted under the editor, and a game of it running. Each
// state gets a fresh page, so leaving the one before never meets an unsaved-changes guard.
test.describe('editor states', () => {
	test.setTimeout(30 * 60_000);
	test.afterEach(() => closeAll());

	test('conflict, restore, deleted, live game', async ({ browser }) => {
		const user = await registerUser();
		const login = await browser.newContext();
		await apiLogin(login.request, user.email);
		const state = path.join(OUT, '.editor-states.json');
		await login.storageState({ path: state });
		await login.close();

		for (const theme of THEMES) {
			for (const size of SIZES) {
				const context = await themedContext(browser, theme, size, state);
				const as = context.request;
				const open = async (id: string) => {
					const page = await context.newPage();
					await page.goto(`/edit?quiz_id=${id}`);
					await expect(titleBox(page)).toBeVisible();
					return page;
				};
				const newQuiz = async () => (await saveQuiz(as, QUIZ)).body.id as string;

				// Saved from another device while this tab was open.
				let id = await newQuiz();
				let page = await open(id);
				const { token } = await (
					await as.post(`/api/v1/editor/start?edit=true&quiz_id=${id}`)
				).json();
				const elsewhere = await as.post(`/api/v1/editor/save?edit_id=${token}`, {
					data: { public: false, ...QUIZ, title: 'Saved on the phone' }
				});
				expect(elsewhere.status()).toBe(200);
				await titleBox(page).fill('Typed on the laptop');
				const choice = page.getByRole('alertdialog', { name: /changed in another tab/i });
				await expect(choice).toBeVisible({ timeout: 15_000 });
				await capture(page, 'editor-conflict', theme);
				await choice.getByRole('button', { name: 'Load the other version' }).click();
				await expect(page.getByRole('region', { name: 'Unsaved changes' })).toBeVisible({
					timeout: 15_000
				});
				await capture(page, 'editor-restore', theme);
				await page.close();

				// Deleted in another tab.
				id = await newQuiz();
				page = await open(id);
				expect((await as.delete(`/api/v1/quiz/delete/${id}`)).status()).toBe(200);
				await titleBox(page).fill('Still mine');
				await expect(page.getByRole('alert')).toContainText('deleted', { timeout: 15_000 });
				await capture(page, 'editor-deleted', theme);
				await page.close();

				// A game of it is running.
				id = await newQuiz();
				const endGame = await liveGame(as, id);
				page = await open(id);
				await expect(page.getByText(/A game of this quiz is running/)).toBeVisible();
				await capture(page, 'editor-live-game', theme);
				await endGame();
				await context.close();
			}
		}
		fs.rmSync(state, { force: true });
	});
});

test.describe('a whole game', () => {
	test.setTimeout(20 * 60_000);

	for (const theme of THEMES) {
		test(`host on a projector, players on phones, ${theme}`, async ({ browser, request }) => {
			const saved = await saveQuiz(request, QUIZ);
			expect(saved.status).toBe(200);
			const hostCtx = await themedContext(browser, theme, PROJECTOR);
			const host = await hostCtx.newPage();
			await rememberAnonQuiz(host, saved.body.id, saved.secret!);
			const pin = await hostFromViewPage(host, saved.body.id);

			const players = [];
			for (const name of ['Robin', 'Sam', 'Alex']) {
				const ctx = await themedContext(browser, theme, PHONE);
				const page = await ctx.newPage();
				await gotoPlayHydrated(page);
				await page.getByRole('textbox', { name: 'Game PIN' }).fill(pin);
				await page.getByRole('textbox', { name: 'Nickname' }).fill(name);
				await page.getByRole('button', { name: 'Join game' }).click();
				await expect(page.getByText(/You're in/)).toBeVisible();
				players.push({ ctx, page });
			}
			const phone = players[0].page;
			// The results screen re-renders as the scoreboard comes up by itself, and a click
			// that lands mid-render is retried against a button that has already gone. The
			// next question showing on a phone is what proves the game moved on.
			const nextQuestion = async (firstAnswer: string) => {
				await clearScoreboardStep(
					host,
					host.getByRole('button', { name: /Next question/ })
				);
				await host
					.getByRole('button', { name: /Next question/ })
					.click({ timeout: 5000 })
					.catch(() => undefined);
				await expect(
					phone.getByRole('button', { name: firstAnswer, exact: true })
				).toBeVisible();
			};
			// Both projector sizes for every host screen.
			const both = async (name: string) => {
				await capture(host, name, theme);
				await host.setViewportSize({ width: 1440, height: 900 });
				await capture(host, name, theme);
				await host.setViewportSize(PROJECTOR);
			};

			await both('host-lobby');
			await capture(phone, 'player-lobby', theme);

			await host.getByRole('button', { name: 'Start game' }).click();
			await host.getByRole('button', { name: /Next question/ }).click();
			await expect(phone.getByRole('button', { name: 'Goliath frog' })).toBeVisible();
			await both('host-question-abcd');
			await capture(phone, 'player-question-abcd', theme);
			await phone.getByRole('button', { name: 'Goliath frog' }).click();
			await players[1].page.getByRole('button', { name: 'Glass frog' }).click();
			await players[2].page.getByRole('button', { name: 'Goliath frog' }).click();
			await showResults(host);
			await both('host-results-abcd');
			await capture(phone, 'player-feedback-right', theme);
			await capture(players[1].page, 'player-feedback-wrong', theme);
			await expect(
				host.getByRole('heading', { name: 'Scoreboard', exact: true })
			).toBeVisible({
				timeout: 10_000
			});
			await both('host-scoreboard');
			await nextQuestion('Frog');

			const choice = (p: Page, name: string) => p.getByRole('button', { name, exact: true });
			await expect(choice(phone, 'Frog')).toBeVisible();
			await both('host-question-check');
			await choice(phone, 'Frog').click();
			await choice(phone, 'Salamander').click();
			await capture(phone, 'player-question-check', theme);
			// Submit is disabled until something is picked, so every phone picks first.
			await choice(players[1].page, 'Lizard').click();
			await choice(players[2].page, 'Frog').click();
			for (const p of players) await p.page.getByRole('button', { name: 'Submit' }).click();
			await showResults(host);
			await both('host-results-check');
			await nextQuestion('Water');
			for (const p of players) await p.page.getByRole('button', { name: 'Water' }).click();
			await showResults(host);
			await advanceToFinalResults(host);
			await expect(host.getByRole('link', { name: 'Finish' })).toBeVisible({
				timeout: 15_000
			});
			await host.waitForTimeout(4000);
			await both('host-podium');
			await capture(phone, 'player-final', theme);

			await hostCtx.close();
			for (const p of players) await p.ctx.close();
		});
	}
});
