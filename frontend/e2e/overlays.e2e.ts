// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// #73: every menu, dialog and drawer a person can reach, opened from its real trigger and
// held to one contract (docs/ux-review-hidden-menus.md has the table):
//
//   1. it is a dialog or alertdialog with an accessible name;
//   2. focus moves into it, and for a destructive confirmation the confirm button is not
//      the element that holds it;
//   3. Tab and Shift+Tab never leave it;
//   4. Escape closes it;
//   5. focus goes back to the trigger (or, where there is none, the test says where).
//
// Opened with the keyboard (focus the trigger, press Enter), so the trigger being
// focusable is part of the check. What other specs already prove is not repeated:
//   - command-palette.e2e.ts: Ctrl+K opens it, search, Enter runs an action, Tab/Enter do
//     nothing while it is closed. This file adds what it does not: role, Escape, focus.
//   - start-dialog.e2e.ts: role, name and Escape of Start game, and its fold. This file
//     adds the Tab trap and the return of focus.
//   - claim.e2e.ts: the prompt's role and that "Not now" holds the focus. Added here: the
//     Tab trap and Escape.
//   - game-exits.e2e.ts: the QR dialog's Escape and return of focus, and every ConfirmAction
//     as a flow (confirm acts, the game ends). Added here: role, name, trap, initial focus.
//   - editor-conflict.e2e.ts: what Keep mine / Load the other version do. Added here: the
//     dialog contract.
// Known bugs are test.fail(...), per docs/e2e-findings.md.

import {
	expect,
	test,
	type APIRequestContext,
	type Browser,
	type Locator,
	type Page
} from '@playwright/test';
import { apiLogin, askForSignIn, registerUser, signedInContext } from './accounts';
import {
	cards,
	enterPin,
	gotoPlayHydrated,
	hostFromViewPage,
	mc,
	openGameOptions,
	PHONE,
	rememberAnonQuiz,
	saveQuiz,
	titleBox,
	joinAsPlayer
} from './helpers';
import { closeAll, join } from './sockets';

test.afterEach(closeAll);

const TAB_PRESSES = 12;

/** A real 160x100 grey PNG. */
const GREY_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAKAAAABkCAAAAAAk3WRTAAAAd0lEQVR4nO3OMQEAIAzAsPl3gFsk7MgBR6Mgcz43rwObgqqgKqgKqoKqoCqoCqqCqqAqqAqqgqqgKqgKqoKqoCqoCqqCqqAqqAqqgqqgKqgKqoKqoCqoCqqCqqAqqAqqgqqgKqgKqoKqoCqoCqqCqqAqqAqqguoC4shcrF9RN5oAAAAASUVORK5CYII=',
	'base64'
);

/** What holds the focus, in words, for failure messages and the findings table. */
const focusedName = (page: Page) =>
	page.evaluate(() => {
		const el = document.activeElement;
		if (!el || el === document.body) return 'body (nothing)';
		const text = (el.getAttribute('aria-label') || el.textContent || '')
			.trim()
			.replace(/\s+/g, ' ');
		return `${el.tagName.toLowerCase()} "${text.slice(0, 40)}"`;
	});

const focusIsIn = (container: Locator) =>
	container.evaluate((el) => el.contains(document.activeElement));

type Contract = {
	/** The dialog, found by role and name, which is the first check. */
	dialog: Locator;
	/** What the person presses. Omit when the overlay opens by itself (then pass `opened`). */
	trigger?: Locator;
	/** Open it some other way than focus + Enter on the trigger. */
	open?: () => Promise<void>;
	/** Already open: skip opening. */
	opened?: boolean;
	/** A destructive or irreversible button in the dialog; it must not hold the focus on open. */
	confirm?: Locator;
	/** Escape is meant to do nothing (the save-conflict dialog). Then it is left open. */
	escapeIgnored?: boolean;
	/** Where focus should land after Escape. Defaults to the trigger; null skips the check. */
	returnTo?: Locator | null;
};

/**
 * The shared contract. Returns what held the focus when the dialog opened, so the table in
 * the doc can say it.
 */
async function expectOverlayContract(page: Page, c: Contract) {
	if (!c.opened) {
		if (c.open) await c.open();
		else {
			await c.trigger!.focus();
			await expect(c.trigger!).toBeFocused();
			await page.keyboard.press('Enter');
		}
	}
	// getByRole with a name is the check that it is a dialog and that it is named.
	await expect(c.dialog).toBeVisible();
	await expect
		.poll(() => focusIsIn(c.dialog), { message: 'focus moved into the dialog' })
		.toBe(true);
	const initial = await focusedName(page);
	test.info().annotations.push({ type: 'initial focus', description: initial });
	if (c.confirm) {
		await expect(
			c.confirm,
			`the confirm button holds the focus on open (${initial})`
		).not.toBeFocused({ timeout: 1_000 });
	}

	for (const key of ['Tab', 'Shift+Tab']) {
		for (let i = 0; i < TAB_PRESSES; i++) {
			await page.keyboard.press(key);
			expect(
				await focusIsIn(c.dialog),
				`${key} #${i + 1} left the dialog, onto ${await focusedName(page)}`
			).toBe(true);
		}
	}

	await page.keyboard.press('Escape');
	if (c.escapeIgnored) {
		await expect(c.dialog).toBeVisible();
		return initial;
	}
	await expect(c.dialog).toBeHidden();
	const back = c.returnTo === undefined ? c.trigger : c.returnTo;
	if (back) {
		await expect(back, `focus after Escape is on ${await focusedName(page)}`).toBeFocused();
	} else {
		test.info().annotations.push({
			type: 'focus after Escape',
			description: await focusedName(page)
		});
	}
	return initial;
}

/** A signed-in owner and a saved quiz with the given questions. */
async function ownerWithQuiz(
	browser: Browser,
	request: APIRequestContext,
	title: string,
	questions = [
		mc('Capital of Portugal?', [
			['Lisbon', true],
			['Porto', false]
		])
	]
) {
	const { context, page, user } = await signedInContext(browser, request);
	const saved = await saveQuiz(context.request, { title, description: 'e2e', questions });
	expect(saved.status).toBe(200);
	return { context, page, user, id: saved.body.id as string, title };
}

const hydrated = async (page: Page) => {
	// A key pressed before hydration does nothing, and the dialog never opens.
	await page.waitForLoadState('networkidle');
};

// ---- Navbar menu (Sheet) ---------------------------------------------------------

test.describe('navbar menu, below md', () => {
	test.use({ viewport: PHONE });

	test('Open menu: a named dialog that holds focus and gives it back', async ({ page }) => {
		await page.goto('/');
		await hydrated(page);
		await expectOverlayContract(page, {
			trigger: page.getByRole('button', { name: 'Open menu' }),
			dialog: page.getByRole('dialog', { name: 'Menu', exact: true })
		});
	});

	test('"Create a quiz" in the menu closes it and opens the create dialog with focus inside', async ({
		page
	}) => {
		await page.goto('/');
		await hydrated(page);
		const menu = page.getByRole('dialog', { name: 'Menu', exact: true });
		await page.getByRole('button', { name: 'Open menu' }).click();
		await expect(menu).toBeVisible();
		await menu.getByRole('link', { name: 'Create a quiz' }).click();
		await expect(menu).toBeHidden();
		const create = page.getByRole('dialog', { name: 'Create a quiz', exact: true });
		await expect(create).toBeVisible();
		await expect.poll(() => focusIsIn(create)).toBe(true);
		await page.keyboard.press('Escape');
		await expect(create).toBeHidden();
	});
});

// ---- Command palette -------------------------------------------------------------

test.describe('command palette (Ctrl+K)', () => {
	const open = async (page: Page) => {
		await page.goto('/my-quizzes');
		await hydrated(page);
		const input = page.getByRole('textbox').last();
		await expect(async () => {
			await page.keyboard.press('Control+k');
			await expect(input).toBeFocused({ timeout: 1_000 });
		}).toPass({ timeout: 15_000 });
		return input;
	};

	test('Escape closes it', async ({ page }) => {
		const input = await open(page);
		await page.keyboard.press('Escape');
		await expect(input).toBeHidden();
	});

	test('Tab stays in the palette while it is open', async ({ page }) => {
		const input = await open(page);
		for (let i = 0; i < 4; i++) {
			await page.keyboard.press('Tab');
			await expect(input).toBeFocused();
		}
	});

	// FIXED 16 Oct. It was a div with role="button" and aria-label="Close" wrapped
	// around the whole panel (commandpalette.svelte:217-221), with no dialog role, so a screen
	// reader announces one button named Close that contains a text field. It also has no
	// label on the text field and no visible trigger: it opens from Ctrl/Cmd+K only, which
	// a phone cannot press.
	test('it is a named dialog', async ({ page }) => {
		await open(page);
		await expect(page.getByRole('dialog', { name: /command|search|palette/i })).toBeVisible({
			timeout: 2_000
		});
	});

	// FIXED 16 Oct (focus is now set by an action). Svelte 5 only honors `autofocus` while <body> holds the focus. With any link,
	// button or field focused (after a Tab, or a click on a button), Ctrl+K opens the palette
	// and the text field is not focused: what the person types goes to the page behind it,
	// and Enter runs nothing. Escape then needs no focus to return, since the old element
	// never lost it. (commandpalette.svelte:238 `autofocus`.)
	test('Ctrl+K from a focused element puts the cursor in the search field', async ({ page }) => {
		await page.goto('/my-quizzes');
		await hydrated(page);
		const link = page.getByRole('link', { name: 'Skip to content' });
		await link.focus();
		await expect(link).toBeFocused();
		const field = page.getByRole('textbox').last();
		// Press until the palette is up, but never again once it is: the key toggles.
		await expect(async () => {
			if ((await field.count()) === 0) await page.keyboard.press('Control+k');
			expect(await field.count()).toBe(1);
		}).toPass({ timeout: 15_000 });
		await expect(field).toBeFocused({ timeout: 2_000 });
	});
});

// ---- Create a quiz ---------------------------------------------------------------

test.describe('create a quiz dialog', () => {
	test('the navbar link opens a named dialog that holds focus and gives it back', async ({
		page
	}) => {
		await page.goto('/');
		await hydrated(page);
		await expectOverlayContract(page, {
			trigger: page
				.getByRole('navigation', { name: 'Main' })
				.getByRole('link', { name: 'Create a quiz' }),
			dialog: page.getByRole('dialog', { name: 'Create a quiz', exact: true })
		});
	});

	test('Import from Excel: the upload step is still a trapped, escapable dialog', async ({
		browser,
		request
	}) => {
		const { context, page } = await signedInContext(browser, request);
		await page.goto('/my-quizzes');
		await hydrated(page);
		const create = page.getByRole('dialog', { name: 'Create a quiz', exact: true });
		const link = page.getByRole('link', { name: /create a quiz/i }).first();
		await link.click();
		await create.getByRole('button', { name: /import from excel/i }).click();
		// The dialog's name follows its title, so the step has to keep a name of its own.
		await expectOverlayContract(page, {
			opened: true,
			dialog: page.getByRole('dialog', { name: 'Import from Excel' }),
			returnTo: link
		});
		await context.close();
	});
});

// ---- View page -------------------------------------------------------------------

test.describe('view page', () => {
	test('Play opens Start game', async ({ browser, request }) => {
		const { context, page, id } = await ownerWithQuiz(browser, request, 'Overlay play');
		await page.goto(`/view/${id}`);
		await hydrated(page);
		await expectOverlayContract(page, {
			trigger: page.getByRole('button', { name: 'Play', exact: true }),
			dialog: page.getByRole('dialog', { name: 'Start game', exact: true })
		});
		await context.close();
	});

	test('Download opens a named dialog', async ({ browser, request }) => {
		const { context, page, id } = await ownerWithQuiz(browser, request, 'Overlay download');
		await page.goto(`/view/${id}`);
		await hydrated(page);
		await expectOverlayContract(page, {
			trigger: page.getByRole('button', { name: 'Download', exact: true }),
			dialog: page.getByRole('dialog', { name: 'Download this quiz' })
		});
		await context.close();
	});

	test('Delete asks first, and Cancel, not Delete, has the focus', async ({
		browser,
		request
	}) => {
		const { context, page, id } = await ownerWithQuiz(browser, request, 'Overlay delete');
		await page.goto(`/view/${id}`);
		await hydrated(page);
		const dialog = page.getByRole('alertdialog', { name: 'Delete this quiz?' });
		await expectOverlayContract(page, {
			trigger: page.getByRole('button', { name: 'Delete', exact: true }),
			dialog,
			confirm: dialog.getByRole('button', { name: 'Delete', exact: true })
		});
		// Nothing was deleted by looking at it.
		expect((await context.request.get(`/api/v1/quiz/get/${id}`)).status()).toBe(200);
		await context.close();
	});
});

// ---- My Quizzes ------------------------------------------------------------------

test.describe('my quizzes', () => {
	test('a row’s Download icon opens the download dialog', async ({ browser, request }) => {
		const { context, page, title } = await ownerWithQuiz(browser, request, 'Overlay row dl');
		await page.goto('/my-quizzes');
		await hydrated(page);
		const row = page.getByRole('listitem').filter({ hasText: title });
		await expectOverlayContract(page, {
			trigger: row.getByRole('button', { name: 'Download', exact: true }),
			dialog: page.getByRole('dialog', { name: 'Download this quiz' })
		});
		await context.close();
	});

	test('a row’s Delete icon asks first (ConfirmAction), and the safe button has the focus', async ({
		browser,
		request
	}) => {
		const { context, page, title, id } = await ownerWithQuiz(
			browser,
			request,
			'Overlay row delete'
		);
		await page.goto('/my-quizzes');
		await hydrated(page);
		const row = page.getByRole('listitem').filter({ hasText: title });
		const dialog = page.getByRole('alertdialog', { name: 'Delete this quiz?' });
		await expectOverlayContract(page, {
			trigger: row.getByRole('button', { name: 'Delete', exact: true }),
			dialog,
			confirm: dialog.getByRole('button', { name: 'Delete', exact: true })
		});
		expect((await context.request.get(`/api/v1/quiz/get/${id}`)).status()).toBe(200);
		await context.close();
	});
});

// ---- Claim prompt ----------------------------------------------------------------

test.describe('claim prompt after sign-in', () => {
	test.beforeEach(async ({ request }) => {
		const config = await (await request.get('/api/v1/utils/config')).json();
		test.skip(!config.anonymous_quizzes_enabled, 'needs ANONYMOUS_QUIZZES_ENABLED on');
	});

	test('it is a named alertdialog that holds focus and closes on Escape', async ({
		browser,
		request
	}) => {
		const saved = await saveQuiz(request, {
			title: `Overlay claim ${Date.now()}`,
			description: 'e2e',
			questions: [
				mc('Capital of Portugal?', [
					['Lisbon', true],
					['Porto', false]
				])
			]
		});
		const user = await registerUser(request);
		const context = await browser.newContext();
		const page = await context.newPage();
		await rememberAnonQuiz(page, saved.body.id, saved.secret!);
		await page.goto('/account/login');
		const { code } = await askForSignIn(page, user.email);
		await page.getByRole('textbox', { name: 'Six-digit code' }).fill(code);
		await page.getByRole('button', { name: 'Sign in', exact: true }).click();
		await page.waitForURL(/\/my-quizzes/);
		const dialog = page.getByRole('alertdialog', { name: /to your account/ });
		// Opened by the page, not by a person: there is no trigger to go back to.
		const initial = await expectOverlayContract(page, {
			opened: true,
			dialog,
			confirm: dialog.getByRole('button', { name: 'Add all to account' }),
			returnTo: null
		});
		expect(initial).toContain('Not now');
		await context.close();
	});
});

// ---- Account settings ------------------------------------------------------------

test.describe('account settings', () => {
	test('Revoke an agent key asks first, and Cancel has the focus', async ({
		browser,
		request
	}) => {
		const { context, page } = await signedInContext(browser, request);
		await page.goto('/account/settings');
		await hydrated(page);
		const card = page.getByTestId('agent-keys');
		await card.getByLabel('Key name').fill('Overlay key');
		await card.getByRole('button', { name: 'Create key' }).click();
		await card.getByRole('button', { name: 'Done' }).click();
		const dialog = page.getByRole('alertdialog', { name: /Revoke/ });
		await expectOverlayContract(page, {
			trigger: card.getByRole('button', { name: 'Revoke Overlay key' }),
			dialog,
			confirm: dialog.getByRole('button', { name: 'Revoke', exact: true })
		});
		await expect(card.getByText('Overlay key')).toBeVisible();
		await context.close();
	});

	test('Delete account asks first, and the destructive button is off until the email is typed', async ({
		browser,
		request
	}) => {
		const { context, page } = await signedInContext(browser, request);
		await page.goto('/account/settings');
		await hydrated(page);
		const dialog = page.getByRole('alertdialog', { name: 'Delete your account?' });
		await expectOverlayContract(page, {
			trigger: page.getByRole('button', { name: 'Delete account', exact: true }),
			dialog,
			confirm: dialog.getByRole('button', { name: 'Delete my account' })
		});
		await context.close();
	});
});

// ---- Editor ----------------------------------------------------------------------

test.describe('editor', () => {
	const QUESTIONS = [
		mc('First question?', [
			['A', true],
			['B', false]
		]),
		mc('Second question?', [
			['C', true],
			['D', false]
		])
	];

	async function openEditor(browser: Browser, request: APIRequestContext, questions = QUESTIONS) {
		const owner = await ownerWithQuiz(
			browser,
			request,
			`Overlay editor ${Date.now()}`,
			questions
		);
		await owner.page.goto(`/edit?quiz_id=${owner.id}`);
		await expect(cards(owner.page)).toHaveCount(questions.length);
		await expect(owner.page.getByRole('textbox', { name: 'Question text' })).toBeVisible();
		await hydrated(owner.page);
		return owner;
	}

	test('Add new question', async ({ browser, request }) => {
		const { context, page } = await openEditor(browser, request);
		await expectOverlayContract(page, {
			trigger: page.getByRole('button', { name: 'Add new question', exact: true }).first(),
			dialog: page.getByRole('dialog', { name: 'Add new question', exact: true })
		});
		await context.close();
	});

	test('Delete question asks first, and Cancel has the focus', async ({ browser, request }) => {
		const { context, page } = await openEditor(browser, request);
		const dialog = page.getByRole('alertdialog', { name: 'Delete this question?' });
		await expectOverlayContract(page, {
			trigger: page.getByRole('button', { name: 'Delete question' }).first(),
			dialog,
			confirm: dialog.getByRole('button', { name: 'Delete', exact: true })
		});
		await expect(cards(page)).toHaveCount(2);
		await context.close();
	});

	test('Advanced settings', async ({ browser, request }) => {
		const { context, page } = await openEditor(browser, request);
		await expectOverlayContract(page, {
			trigger: page.getByRole('button', { name: 'Advanced settings' }).first(),
			dialog: page.getByRole('dialog', { name: 'Advanced settings', exact: true })
		});
		await context.close();
	});

	test('Add an image opens the uploader', async ({ browser, request }) => {
		const { context, page } = await openEditor(browser, request);
		await expectOverlayContract(page, {
			trigger: page.getByRole('button', { name: /Add an image/ }).first(),
			dialog: page.getByRole('dialog', { name: 'Add an image' })
		});
		await context.close();
	});

	test.describe('full-screen image', () => {
		async function withImage(browser: Browser, request: APIRequestContext) {
			const { context, page } = await signedInContext(browser, request);
			// Big enough that the delete badge, which sits on the corner, is not over its middle.
			const up = await context.request.post('/api/v1/storage/', {
				multipart: { file: { name: 'grey.png', mimeType: 'image/png', buffer: GREY_PNG } }
			});
			expect(up.status(), await up.text()).toBe(200);
			const image = (await up.json()).id as string;
			const saved = await saveQuiz(context.request, {
				title: `Overlay image ${Date.now()}`,
				description: 'e2e',
				questions: [{ ...QUESTIONS[0], image }]
			} as Parameters<typeof saveQuiz>[1]);
			await page.goto(`/edit?quiz_id=${saved.body.id}`);
			await expect(cards(page)).toHaveCount(1);
			const img = page.locator('img[src^="blob:"]').first();
			await expect(img).toBeVisible();
			await hydrated(page);
			return { context, page, img };
		}

		// With a pointer: the image is not focusable, so Escape cannot return focus to it.
		// Where focus lands instead is recorded as an annotation.
		test('a click opens a named dialog that holds focus and closes on Escape', async ({
			browser,
			request
		}) => {
			const { context, page, img } = await withImage(browser, request);
			await expectOverlayContract(page, {
				open: () => img.click(),
				dialog: page.getByRole('dialog', { name: 'Image', exact: true }),
				returnTo: null
			});
			await context.close();
		});

		// FIXED 16 Oct. The picture that opens full screen was an <img onclick> (MediaComponent.svelte:90-95).
		// It has no role, no tabindex and no key handler, so a keyboard user cannot open it
		// at all. The same component draws the host's question image and the player's.
		test('the image can be opened from the keyboard', async ({ browser, request }) => {
			const { context, page, img } = await withImage(browser, request);
			await img.focus();
			await page.keyboard.press('Enter');
			await expect(page.getByRole('dialog', { name: 'Image', exact: true })).toBeVisible({
				timeout: 2_000
			});
			await context.close();
		});
	});

	test('a save conflict is a named alertdialog that Escape leaves open, with the safe choice first', async ({
		browser,
		request
	}) => {
		const { context, page, id } = await openEditor(browser, request);
		// Another device saves first (the same two calls editor-conflict.e2e.ts makes).
		const { token } = await (
			await context.request.post(`/api/v1/editor/start?edit=true&quiz_id=${id}`)
		).json();
		const res = await context.request.post(`/api/v1/editor/save?edit_id=${token}`, {
			data: {
				public: false,
				title: 'Saved elsewhere',
				description: 'e2e',
				questions: QUESTIONS
			}
		});
		expect(res.status(), await res.text()).toBe(200);
		await titleBox(page).fill('Typed here');
		const dialog = page.getByRole('alertdialog', { name: /changed in another tab/i });
		await expect(dialog).toBeVisible({ timeout: 15_000 });
		const initial = await expectOverlayContract(page, {
			opened: true,
			dialog,
			// "Keep mine" overwrites the other device's work.
			confirm: dialog.getByRole('button', { name: 'Keep mine' }),
			escapeIgnored: true
		});
		test.info().annotations.push({ type: 'initial focus', description: initial });
		await context.close();
	});
});

// ---- Live game -------------------------------------------------------------------

test.describe('live game', () => {
	async function hostLobby(browser: Browser, request: APIRequestContext) {
		const { context, page, id } = await ownerWithQuiz(browser, request, 'Overlay game');
		const pin = await hostFromViewPage(page, id);
		return { context, page, pin };
	}

	test('lobby: the full-screen QR code', async ({ browser, request }) => {
		const { context, page } = await hostLobby(browser, request);
		await expectOverlayContract(page, {
			trigger: page.getByRole('button', { name: 'Show the QR code full screen' }),
			dialog: page.getByRole('dialog', { name: 'QR code to join the game' })
		});
		await context.close();
	});

	test('lobby: Cancel game asks first, and Keep waiting has the focus', async ({
		browser,
		request
	}) => {
		const { context, page } = await hostLobby(browser, request);
		const dialog = page.getByRole('alertdialog', { name: 'Cancel this game?' });
		await expectOverlayContract(page, {
			trigger: page.getByRole('button', { name: 'Cancel game', exact: true }),
			dialog,
			confirm: dialog.getByRole('button', { name: 'Cancel game', exact: true })
		});
		await context.close();
	});

	test('host: End game asks first, and Keep playing has the focus', async ({
		browser,
		request
	}) => {
		const { context, page, pin } = await hostLobby(browser, request);
		expect((await join(pin, 'Ana')).outcome).toBe('joined');
		await page.getByRole('button', { name: 'Start game' }).click();
		const dialog = page.getByRole('alertdialog', { name: 'End the game now?' });
		await expectOverlayContract(page, {
			trigger: page.getByRole('button', { name: 'End game', exact: true }),
			dialog,
			confirm: dialog.getByRole('button', { name: 'End game', exact: true })
		});
		await context.close();
	});

	test('player: Leave game asks first, and Cancel has the focus', async ({
		browser,
		request
	}) => {
		const { context, pin } = await hostLobby(browser, request);
		const { context: phoneContext, page: phone } = await joinAsPlayer(browser, pin, 'Ana');
		await expect(phone.getByText("You're in, Ana")).toBeVisible();
		const dialog = phone.getByRole('alertdialog', { name: 'Leave this game?' });
		await expectOverlayContract(phone, {
			trigger: phone.getByRole('button', { name: 'Leave game', exact: true }),
			dialog,
			confirm: dialog.getByRole('button', { name: 'Leave game', exact: true })
		});
		await phoneContext.close();
		await context.close();
	});
});

// ---- Touch: the trigger and everything inside, on a phone ------------------------
//
// touch-targets.e2e.ts audits the pages and the menu drawer, but not what is inside the
// dialogs they open. This opens each one by a tap and measures its controls the same way
// (the fq-touch-target expansion counts), so a 28px close button is a finding here.

test.describe('touch targets inside the overlays, at 390 with a touch screen', () => {
	const CONTROLS =
		'a[href], button, [role=button], [role=switch], [role=checkbox], [role=tab], input:not([type=hidden]), select, textarea, summary';

	/** Controls in the open dialog whose press area is under 44x44. */
	const smallControls = (page: Page) =>
		page.evaluate(async (sel) => {
			// Mid-entrance a dialog is scaled to 95%, which would shrink every target.
			const settled = document
				.getAnimations()
				.filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime as number));
			await Promise.all(settled.map((a) => a.finished.catch(() => undefined)));
			const root = document.querySelector('[role=dialog], [role=alertdialog]');
			if (!root) return ['no dialog is open'];
			const out: string[] = [];
			for (const el of root.querySelectorAll(sel)) {
				if (el.closest('.sr-only, [inert], [aria-hidden=true]')) continue;
				const cs = getComputedStyle(el);
				if (cs.visibility === 'hidden' || cs.display === 'none') continue;
				const label = el.closest('label');
				const box = label?.control === el ? label : el;
				const r = box.getBoundingClientRect();
				if (!r.width) continue;
				let w = r.width;
				let h = r.height;
				const after = getComputedStyle(box, '::after');
				if (
					after.content !== 'none' &&
					after.position === 'absolute' &&
					getComputedStyle(box).position !== 'static'
				) {
					w = Math.max(w, parseFloat(after.width) || 0);
					h = Math.max(h, parseFloat(after.height) || 0);
				}
				if (w < 43.5 || h < 43.5) {
					const name = (
						el.getAttribute('aria-label') ||
						(el as HTMLButtonElement).labels?.[0]?.textContent ||
						el.textContent ||
						el.getAttribute('placeholder') ||
						el.tagName
					)
						.trim()
						.replace(/\s+/g, ' ')
						.slice(0, 40);
					out.push(`${name}: ${Math.round(w)}x${Math.round(h)}`);
				}
			}
			return out;
		}, CONTROLS);

	/** A signed-in phone with a quiz of its own. */
	async function phoneOwner(browser: Browser, request: APIRequestContext, title: string) {
		const user = await registerUser(request);
		const context = await browser.newContext({
			viewport: PHONE,
			isMobile: true,
			hasTouch: true
		});
		await apiLogin(context.request, user.email);
		const saved = await saveQuiz(context.request, {
			title,
			description: 'e2e',
			questions: [
				mc('First question?', [
					['A', true],
					['B', false]
				]),
				mc('Second question?', [
					['C', true],
					['D', false]
				])
			]
		});
		return { context, page: await context.newPage(), id: saved.body.id as string, title };
	}

	/** Taps the trigger, measures the dialog it opens, and closes it with Escape. */
	async function measure(
		page: Page,
		found: Record<string, string[]>,
		name: string,
		trigger: Locator,
		dialog: Locator,
		prep?: () => Promise<void>
	) {
		await trigger.tap();
		await expect(dialog, `${name} did not open on a tap`).toBeVisible();
		await prep?.();
		found[name] = await smallControls(page);
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
	}

	// Known findings, written down rather than skipped: the test stays green while they
	// exist and goes red when one is fixed, which is the cue to delete its line here
	// (docs/e2e-findings.md, the same idea as test.fail). Empty since 16 Oct: the Game
	// options row is min-h-11, and the Switch's press area reaches 44px tall.
	const KNOWN: Record<string, string[]> = {};
	const expected = (found: Record<string, string[]>) =>
		Object.fromEntries(Object.keys(found).map((k) => [k, KNOWN[k] ?? []]));

	test('view page and My Quizzes', async ({ browser, request }) => {
		const { context, page, id, title } = await phoneOwner(browser, request, 'Overlay touch');
		const found: Record<string, string[]> = {};
		await page.goto(`/view/${id}`);
		await hydrated(page);
		await measure(
			page,
			found,
			'view: Start game',
			page.getByRole('button', { name: 'Play', exact: true }),
			page.getByRole('dialog', { name: 'Start game' }),
			// With the fold open, so the three switches are measured too.
			() => openGameOptions(page.getByRole('dialog', { name: 'Start game' }))
		);
		await measure(
			page,
			found,
			'view: Download',
			page.getByRole('button', { name: 'Download', exact: true }),
			page.getByRole('dialog', { name: 'Download this quiz' })
		);
		await measure(
			page,
			found,
			'view: Delete',
			page.getByRole('button', { name: 'Delete', exact: true }),
			page.getByRole('alertdialog', { name: 'Delete this quiz?' })
		);
		await page.goto('/my-quizzes');
		await hydrated(page);
		const row = page.getByRole('listitem').filter({ hasText: title });
		await measure(
			page,
			found,
			'my quizzes: Download',
			row.getByRole('button', { name: 'Download', exact: true }),
			page.getByRole('dialog', { name: 'Download this quiz' })
		);
		await measure(
			page,
			found,
			'my quizzes: Delete',
			row.getByRole('button', { name: 'Delete', exact: true }),
			page.getByRole('alertdialog', { name: 'Delete this quiz?' })
		);
		expect(found).toEqual(expected(found));
		await context.close();
	});

	test('editor', async ({ browser, request }) => {
		const { context, page, id } = await phoneOwner(browser, request, 'Overlay touch editor');
		const found: Record<string, string[]> = {};
		await page.goto(`/edit?quiz_id=${id}`);
		await expect(cards(page)).toHaveCount(2);
		await expect(page.getByRole('textbox', { name: 'Question text' })).toBeVisible();
		await hydrated(page);
		await measure(
			page,
			found,
			'editor: Add new question',
			page.getByRole('button', { name: 'Add new question', exact: true }).first(),
			page.getByRole('dialog', { name: 'Add new question', exact: true })
		);
		await measure(
			page,
			found,
			'editor: Advanced settings',
			page.getByRole('button', { name: 'Advanced settings' }).first(),
			page.getByRole('dialog', { name: 'Advanced settings', exact: true })
		);
		await measure(
			page,
			found,
			'editor: Delete question',
			page.getByRole('button', { name: 'Delete question' }).first(),
			page.getByRole('alertdialog', { name: 'Delete this question?' })
		);
		expect(found).toEqual(expected(found));
		await context.close();
	});

	test('My Account, and the create dialog from the menu', async ({ browser, request }) => {
		const { context, page } = await phoneOwner(browser, request, 'Overlay touch account');
		const found: Record<string, string[]> = {};
		await page.goto('/account/settings');
		await hydrated(page);
		const card = page.getByTestId('agent-keys');
		await card.getByLabel('Key name').fill('Touch key');
		await card.getByRole('button', { name: 'Create key' }).tap();
		await card.getByRole('button', { name: 'Done' }).tap();
		await measure(
			page,
			found,
			'settings: Revoke',
			card.getByRole('button', { name: 'Revoke Touch key' }),
			page.getByRole('alertdialog', { name: /Revoke/ })
		);
		await measure(
			page,
			found,
			'settings: Delete account',
			page.getByRole('button', { name: 'Delete account', exact: true }),
			page.getByRole('alertdialog', { name: 'Delete your account?' })
		);
		await page.goto('/');
		await hydrated(page);
		await page.getByRole('button', { name: 'Open menu' }).tap();
		await page
			.getByRole('dialog', { name: 'Menu', exact: true })
			.getByRole('link', { name: 'Create a quiz' })
			.tap();
		await expect(
			page.getByRole('dialog', { name: 'Create a quiz', exact: true })
		).toBeVisible();
		found['create dialog'] = await smallControls(page);
		expect(found).toEqual(expected(found));
		await context.close();
	});

	test('a player in a lobby: Leave game', async ({ browser, request }) => {
		const owner = await ownerWithQuiz(browser, request, 'Overlay touch game');
		const pin = await hostFromViewPage(owner.page, owner.id);
		const ctx = await browser.newContext({ viewport: PHONE, isMobile: true, hasTouch: true });
		const phone = await ctx.newPage();
		await gotoPlayHydrated(phone);
		await enterPin(phone, pin);
		await phone.getByRole('textbox', { name: 'Nickname' }).fill('thumb');
		await phone.getByRole('button', { name: 'Join game' }).tap();
		await expect(phone.getByText("You're in, thumb")).toBeVisible();
		const found: Record<string, string[]> = {};
		await measure(
			phone,
			found,
			'player: Leave game',
			phone.getByRole('button', { name: 'Leave game', exact: true }),
			phone.getByRole('alertdialog', { name: 'Leave this game?' })
		);
		expect(found).toEqual(expected(found));
		await ctx.close();
		await owner.context.close();
	});
});

// ---- The contract itself can fail ------------------------------------------------
//
// A check that has never failed proves nothing. Each of these is a dialog built wrong in
// one way, and the contract has to say so.

test.describe('the contract catches a dialog that is built wrong', () => {
	/** A page with one trigger and one dialog. `trap`, `confirmFirst` and `restore` are the knobs. */
	const dialogPage = (
		page: Page,
		o: { trap: boolean; confirmFirst?: boolean; restore: boolean }
	) =>
		page.setContent(`
			<button id="t">Open</button><button id="behind">Behind</button>
			<div id="d" role="dialog" aria-label="Fake" hidden>
				${o.confirmFirst ? '<button id="a">Delete</button><button id="b">Cancel</button>' : '<button id="a">Cancel</button><button id="b">Delete</button>'}
			</div>
			<script>
				const t = document.getElementById('t'), d = document.getElementById('d');
				const [a, b] = [document.getElementById('a'), document.getElementById('b')];
				t.onclick = () => { d.hidden = false; a.focus(); };
				d.addEventListener('keydown', (e) => {
					if (e.key === 'Escape') { d.hidden = true; ${o.restore ? 't.focus();' : 'document.activeElement.blur();'} }
					if (${o.trap} && e.key === 'Tab') {
						e.preventDefault();
						const next = e.shiftKey ? (document.activeElement === a ? b : a) : (document.activeElement === a ? b : a);
						next.focus();
					}
				});
			</script>`);
	const contract = (page: Page, confirm?: string) => ({
		trigger: page.locator('#t'),
		dialog: page.getByRole('dialog', { name: 'Fake' }),
		confirm: confirm ? page.getByRole('button', { name: confirm }) : undefined
	});

	test('a well-built one passes', async ({ page }) => {
		await dialogPage(page, { trap: true, restore: true });
		await expectOverlayContract(page, contract(page, 'Delete'));
	});

	test('no trap: Tab leaves', async ({ page }) => {
		await dialogPage(page, { trap: false, restore: true });
		await expect(expectOverlayContract(page, contract(page))).rejects.toThrow(
			/left the dialog/
		);
	});

	test('focus not given back after Escape', async ({ page }) => {
		await dialogPage(page, { trap: true, restore: false });
		await expect(expectOverlayContract(page, contract(page))).rejects.toThrow(
			/focus after Escape/
		);
	});

	test('the confirm button holds the focus on open', async ({ page }) => {
		await dialogPage(page, { trap: true, confirmFirst: true, restore: true });
		await expect(expectOverlayContract(page, contract(page, 'Delete'))).rejects.toThrow(
			/holds the focus on open/
		);
	});
});
