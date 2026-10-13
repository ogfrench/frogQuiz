// SPDX-FileCopyrightText: 2026 frogQuiz contributors
// SPDX-License-Identifier: MPL-2.0

// Separate, explicitly simulated artifact. The app's real journey lives in excel-import.e2e.ts.
import { expect, test } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';

const artifact = pathToFileURL(path.resolve(process.cwd(), '../docs/quiz-creation-preview.html')).href;
const OUT = path.resolve(process.cwd(), '../e2e/.data/shots');

test('interactive preview reads the workbook and demonstrates partial claim retry', async ({
	page,
	request
}) => {
	await page.goto(artifact);
	await expect(page.getByText('Interactive flow demonstration.', { exact: true })).toBeVisible();
	const template = await request.get('/api/v1/quiz/excel-template');
	expect(template.status()).toBe(200);
	const file = {
		name: 'frogquiz-excel-template.xlsx',
		mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		buffer: await template.body()
	};
	const importQuiz = async () => {
		await page.getByRole('button', { name: '+ Create a quiz', exact: true }).click();
		await page.getByRole('button', { name: /Import from Excel/ }).click();
		await page.locator('input[type=file]').setInputFiles(file);
		await expect(page.getByText('2 questions, ready to import')).toBeVisible();
	};
	await importQuiz();
	await expect(page.getByText('1. What is the capital of Portugal?', { exact: true })).toBeVisible();
	await page.screenshot({ path: `${OUT}/demo-1440-excel-preview.png`, animations: 'disabled' });
	await page.getByRole('button', { name: 'Create quiz', exact: true }).click();
	await page.getByRole('textbox', { name: 'Quiz title', exact: true }).fill('Edited preview quiz');
	await page.getByRole('button', { name: 'Save quiz', exact: true }).click();
	await page.getByRole('button', { name: 'Host', exact: true }).click();
	await page.getByRole('button', { name: 'Start game', exact: true }).click();
	await page.getByRole('button', { name: 'Lisbon', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Lisbon ✓ Correct', exact: true })).toBeDisabled();
	await page.getByRole('button', { name: 'Next question', exact: true }).click();
	await page.getByRole('button', { name: 'Show final results', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Game finished' })).toBeVisible();
	await page.getByRole('button', { name: 'Back to My Quizzes' }).click();
	await importQuiz();
	await page.getByRole('button', { name: 'Create quiz', exact: true }).click();
	await page.getByRole('button', { name: 'Save quiz', exact: true }).click();
	await page.getByRole('button', { name: 'Sign in (simulate)', exact: true }).click();
	// Sign-in alone leaves both quizzes unclaimed.
	await expect(page.getByRole('button', { name: 'Claim', exact: true })).toHaveCount(2);
	await page.getByLabel('Simulate a claim response').selectOption('429');
	await page.getByRole('button', { name: 'Keep all (2)', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Claim', exact: true })).toHaveCount(1);
	await expect(page.getByRole('status')).toContainText('1 quiz kept.');
	await page.screenshot({ path: `${OUT}/demo-1440-partial-claim.png`, animations: 'disabled' });
	await page.getByRole('button', { name: 'Keep all (1)', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Claim', exact: true })).toHaveCount(0);
	await expect(page.getByText('Account · permanent (simulated)', { exact: true })).toHaveCount(2);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.screenshot({ path: `${OUT}/demo-390-account-library.png`, animations: 'disabled' });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('interactive preview rejects a broken workbook without offering create', async ({ page }) => {
	await page.goto(artifact);
	await page.getByRole('button', { name: '+ Create a quiz', exact: true }).click();
	await page.getByRole('button', { name: /Import from Excel/ }).click();
	await page.locator('input[type=file]').setInputFiles({
		name: 'broken.xlsx',
		mimeType: 'application/octet-stream',
		buffer: Buffer.from('not Excel')
	});
	await expect(page.getByRole('status')).toContainText('could not be read as an .xlsx');
	await expect(page.getByRole('button', { name: 'Create quiz', exact: true })).toHaveCount(0);
});

test('interactive preview reads all 50 questions while keeping Create quiz visible', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(artifact);
	await page.getByRole('button', { name: '+ Create a quiz', exact: true }).click();
	await page.getByRole('button', { name: /Import from Excel/ }).click();
	await page.locator('input[type=file]').setInputFiles({
		name: 'quiz-creation-50-questions.xlsx',
		mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		buffer: await readFile(path.resolve(process.cwd(), '../docs/quiz-creation-50-questions.xlsx'))
	});
	await expect(page.getByText('50 questions, ready to import')).toBeVisible();
	const list = page.getByLabel('Imported questions preview');
	await expect(list.locator('.question')).toHaveCount(50);
	await list.locator('summary').first().click();
	await expect(list.getByText('Correct answer 1', { exact: false })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Create quiz', exact: true })).toBeInViewport();
	await page.getByRole('button', { name: 'Jump to last', exact: true }).click();
	await list.locator('.question').last().scrollIntoViewIfNeeded();
	await expect(list.locator('.question').last()).toBeInViewport();
	await expect(page.getByRole('button', { name: 'Create quiz', exact: true })).toBeInViewport();
	await page.screenshot({ path: `${OUT}/demo-390-50-questions.png`, animations: 'disabled' });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
