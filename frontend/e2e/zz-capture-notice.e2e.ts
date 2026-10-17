// Scratch capture, not committed.
import { expect, test } from '@playwright/test';
import { signedInContext } from './accounts';
import { mc, openViewMenu, saveQuiz } from './helpers';
test('capture', async ({ browser, request }) => {
	const owner = await signedInContext(browser, request);
	await owner.context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await owner.page.setViewportSize({ width: 1280, height: 800 });
	const saved = await saveQuiz(owner.context.request, { title: 'Frog anatomy', description: 'Three questions', questions: [mc('Legs?', [['Four', true], ['Two', false]])] });
	await owner.page.goto('/view/' + saved.body.id);
	await (await openViewMenu(owner.page)).getByRole('menuitem', { name: 'Copy link' }).click();
	await expect(owner.page.getByText('Link copied', { exact: true })).toBeVisible();
	await owner.page.mouse.move(5, 5);
	await owner.page.screenshot({ path: '/tmp/claude-0/-home-user/e990234f-c5dc-5dc9-bb52-780c30c68413/scratchpad/lobby/notice-light.png' });
	await owner.page.evaluate(() => { document.documentElement.classList.add('dark'); });
	await owner.page.screenshot({ path: '/tmp/claude-0/-home-user/e990234f-c5dc-5dc9-bb52-780c30c68413/scratchpad/lobby/notice-dark.png' });
	await owner.page.setViewportSize({ width: 390, height: 844 });
	await owner.page.evaluate(() => { document.documentElement.classList.remove('dark'); });
	await (await openViewMenu(owner.page)).getByRole('menuitem', { name: 'Copy link' }).click();
	await expect(owner.page.getByText('Link copied', { exact: true })).toBeVisible();
	await owner.page.screenshot({ path: '/tmp/claude-0/-home-user/e990234f-c5dc-5dc9-bb52-780c30c68413/scratchpad/lobby/notice-phone.png' });
	await owner.context.close();
});
