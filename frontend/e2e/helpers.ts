// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import {
	expect,
	type APIRequestContext,
	type Browser,
	type Locator,
	type Page
} from '@playwright/test';

export const ANON_KEY = 'frogquiz_anon_secrets';
export const PHONE = { width: 390, height: 844 };

export type Answer = { answer: string; right: boolean };
export type Question = {
	question: string;
	time: string;
	type?: 'ABCD' | 'CHECK';
	answers: Answer[] | unknown;
};
export type QuizInput = {
	title: string;
	description: string;
	public?: boolean;
	questions: Question[];
};

export const mc = (question: string, answers: [string, boolean][], time = '20'): Question => ({
	question,
	time,
	type: 'ABCD',
	answers: answers.map(([answer, right]) => ({ answer, right }))
});

/** Saves a quiz through the same two calls the editor makes. Anonymous unless a token is given. */
export async function saveQuiz(request: APIRequestContext, quiz: QuizInput, bearer?: string) {
	const headers: Record<string, string> = bearer ? { Authorization: `Bearer ${bearer}` } : {};
	const start = await request.post('/api/v1/editor/start?edit=false', { headers });
	expect(start.status(), await start.text()).toBe(200);
	const { token } = await start.json();
	const res = await request.post(`/api/v1/editor/finish?edit_id=${token}`, {
		headers,
		data: { public: false, ...quiz }
	});
	const body = res.status() === 200 ? await res.json() : await res.text();
	return {
		status: res.status(),
		body,
		secret: res.headers()['x-anon-secret'] as string | undefined
	};
}

/** A real 1x1 PNG. Uppy's Compressor runs on the bytes, so zeros named .png do not do. */
export const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
	'base64'
);

/** Uploads PNG through the API, anonymously unless `request` carries a session. Returns its id. */
export async function uploadPng(request: APIRequestContext) {
	const res = await request.post('/api/v1/storage/', {
		multipart: { file: { name: 'dot.png', mimeType: 'image/png', buffer: PNG } }
	});
	expect(res.status(), await res.text()).toBe(200);
	return (await res.json()).id as string;
}

export async function rememberAnonQuiz(page: Page, id: string, secret: string) {
	await page.goto('/');
	await page.evaluate(
		([key, quizId, s]) => {
			const all = JSON.parse(localStorage.getItem(key) ?? '{}');
			all[quizId] = s;
			localStorage.setItem(key, JSON.stringify(all));
		},
		[ANON_KEY, id, secret]
	);
}

/** From the quiz view page, through the start modal, into the host lobby. Returns the PIN. */
export async function hostFromViewPage(
	page: Page,
	quizId: string,
	opts: { showOnDevices?: boolean } = {}
): Promise<string> {
	await page.goto(`/view/${quizId}`);
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Start game' });
	await expect(dialog).toBeVisible();
	if (opts.showOnDevices) {
		// Kahoot's "Show questions & answers on participants' devices" (MVP.md D16). Off
		// by default, so a test that wants it has to say so.
		const toggle = dialog.getByRole('switch', {
			name: "Show questions and answers on players' devices"
		});
		await expect(toggle).toHaveAttribute('aria-checked', 'false');
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-checked', 'true');
	}
	await dialog.getByRole('button', { name: 'Start game' }).click();
	await page.waitForURL(/\/admin\?/);
	const pin = new URL(page.url()).searchParams.get('pin');
	expect(pin).toMatch(/^\d{6}$/);
	return pin!;
}

/**
 * The PIN box is server-rendered and autofocused, so it accepts input before the page
 * hydrates -- and anything entered then is lost. /play logs "Connected!" once its
 * socket is up, which is after hydration.
 */
export async function gotoPlayHydrated(page: Page) {
	const connected = page.waitForEvent('console', {
		predicate: (m) => m.text() === 'Connected!',
		timeout: 15_000
	});
	await page.goto('/play');
	await connected;
}

export async function joinAsPlayer(browser: Browser, pin: string, username: string) {
	const context = await browser.newContext({ viewport: PHONE });
	const page = await context.newPage();
	await gotoPlayHydrated(page);
	// The PIN form has no submit handler: the sixth digit advances it on its own.
	await page.getByRole('textbox', { name: 'Game PIN' }).fill(pin);
	await page.getByRole('textbox', { name: 'Nickname' }).fill(username);
	await page.getByRole('button', { name: 'Join game' }).click();
	return { context, page };
}

/** Horizontal overflow is a recurring bug here (w-screen); assert it wherever a page is visited. */
export async function expectNoHorizontalOverflow(page: Page) {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow, 'page scrolls horizontally').toBeLessThanOrEqual(0);
}

/**
 * Gets the host to the answers screen of the question that just ended.
 *
 * Since 8 Oct the answers come up by themselves, 0.8 s after the question ends (time up,
 * everyone answered, or Stop time), and "Show results" is only a skip-ahead that is on
 * screen for that moment. Clicking it unconditionally raced the automatic flow and could
 * wait 30 s for a button that had already gone. This presses it if it is still there and
 * waits for the step after the answers either way: the scoreboard's skip-ahead, the
 * podium, or the next question (a poll, or nobody answered).
 */
export async function showResults(page: Page) {
	const show = page.getByRole('button', { name: /Show results/ });
	const after = page.getByRole('button', {
		name: /^(Scoreboard|Get final results|Next question)/
	});
	await expect(show.or(after).first()).toBeVisible({ timeout: 60_000 });
	await show.click({ timeout: 1000 }).catch(() => undefined);
	await expect(after.first()).toBeVisible({ timeout: 15_000 });
}

/**
 * The question is over on the host: the clock's step ("Stop time") has given way to
 * whatever follows it. "Show results is visible" used to mean this, but that button is
 * now only up for the moment before the answers come up by themselves.
 */
export async function expectQuestionEnded(page: Page, timeout = 20_000) {
	await expect(
		page
			.getByRole('button', {
				name: /^(Show results|Scoreboard|Get final results|Next question)/
			})
			.first()
	).toBeVisible({ timeout });
}

/**
 * Clears the host's standings step, if it is showing.
 *
 * A round is answers, then standings, then move on (`nextStep` in
 * `lib/play/admin/next_step.ts`, matching how Kahoot sequences a round). The standings
 * come up by themselves three seconds after the answers; the "Scoreboard" button skips
 * ahead to them. The last question has no standings step, so the podium is not given
 * away, and neither does a slide, a poll or a hide-results question. Pass `next` for
 * those; without it the step is asserted to exist.
 *
 * It waits rather than reading `isVisible()` once: between "Show results" and the results
 * arriving the bar shows neither button, and a single read under load skipped the step
 * (journey-remote-call, 2 Oct). The click tolerates the button going in the meantime,
 * since the automatic scoreboard takes it away.
 */
export async function clearScoreboardStep(page: Page, next?: Locator) {
	const scoreboard = page.getByRole('button', { name: 'Scoreboard' });
	await expect(next ? scoreboard.or(next).first() : scoreboard).toBeVisible({
		timeout: 15_000
	});
	await scoreboard.click({ timeout: 1000 }).catch(() => undefined);
}

/** Standings, then the next question. */
export async function advancePastResults(page: Page) {
	const next = page.getByRole('button', { name: /Next question/ });
	await clearScoreboardStep(page, next);
	await next.click();
}

/** Standings, then the podium. */
export async function advanceToFinalResults(page: Page) {
	const finalResults = page.getByRole('button', { name: /final results/i });
	await clearScoreboardStep(page, finalResults);
	await finalResults.click();
}

// ---- Driving the editor ----------------------------------------------------
// Lifted out of editor.e2e.ts on 2026-10-02 so the journey specs build a quiz the way a
// person does, through the editor, rather than posting one to the API.

export const titleBox = (page: Page) => page.getByRole('textbox', { name: 'Quiz title' });
export const questionBox = (page: Page) => page.getByRole('textbox', { name: 'Question text' });
export const saveQuizButton = (page: Page) => page.getByRole('button', { name: 'Save' });
export const cards = (page: Page) => page.locator('[data-question-card]');

export async function addQuestion(
	page: Page,
	kind: RegExp,
	title: string,
	answers: [string, boolean][]
) {
	await page
		.getByRole('button', { name: /Add new question|Add your first question/ })
		.first()
		.click();
	await page.getByRole('button', { name: kind }).click();
	// Only the open card holds a rich-text field; the others are collapsed to plain text.
	await questionBox(page).fill(title);
	for (let i = 0; i < answers.length; i++)
		await page.getByRole('button', { name: 'Add an answer' }).click();
	const inputs = page.getByRole('textbox', { name: 'Enter an answer' });
	for (const [i, [text, right]] of answers.entries()) {
		await inputs.nth(i).fill(text);
		if (right)
			await page
				.getByRole('button', { name: `Mark as correct: ${text}`, exact: true })
				.click();
	}
}

export async function startNewQuiz(page: Page, title: string) {
	await page.goto('/create');
	await titleBox(page).fill(title);
	await page.getByRole('textbox', { name: 'Description' }).fill('Made in the editor');
}
