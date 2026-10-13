// Temporary: screenshots of the create dialog with the API mocked.
import { test } from '@playwright/test';
import path from 'node:path';
import { apiLogin, registerUser } from './accounts';

const OUT = path.resolve(process.cwd(), '../e2e/.data/shots');
const sizes = [
	{ name: '390', width: 390, height: 844 },
	{ name: '834', width: 834, height: 1112 },
	{ name: '1440', width: 1440, height: 900 }
];

const clean = {
	title: 'Capital cities of Europe',
	description: 'A warm-up',
	errors: [],
	questions: [
		{
			row: 1,
			question: 'What is the capital of Portugal?',
			type: 'single',
			time: 20,
			answers: [
				{ text: 'Lisbon', right: true },
				{ text: 'Porto', right: false },
				{ text: 'Faro', right: false }
			]
		},
		{
			row: 2,
			question: 'Which of these are capitals?',
			type: 'multiple',
			time: 30,
			answers: [
				{ text: 'Madrid', right: true },
				{ text: 'Barcelona', right: false },
				{ text: 'Rome', right: true },
				{ text: 'Milan', right: false }
			]
		},
		{
			row: 3,
			question: 'What is the capital of Austria?',
			type: 'single',
			time: 20,
			answers: [
				{ text: 'Vienna', right: true },
				{ text: 'Salzburg', right: false }
			]
		}
	]
};
const broken = {
	...clean,
	questions: clean.questions.slice(0, 2),
	errors: [
		{ row: 4, column: 'Time', message: 'must be a whole number from 1 to 120' },
		{ row: 5, column: 'Correct answers', message: 'points at Answer 5, which is empty' },
		{ row: 7, column: 'Answer 1', message: 'needs at least 2 answers' }
	]
};

for (const theme of ['light', 'dark']) {
	for (const s of sizes) {
		test(`create dialog ${theme} ${s.name}`, async ({ browser, request }) => {
			const user = await registerUser(request);
			const context = await browser.newContext({
				viewport: { width: s.width, height: s.height }
			});
			await context.addInitScript((t) => localStorage.setItem('theme', t), theme);
			await apiLogin(context.request, user.email);
			const page = await context.newPage();
			let mode: 'clean' | 'broken' = 'broken';
			await page.route('**/api/v1/quiz/excel-import*', (route) =>
				route.fulfill({ json: mode === 'clean' ? clean : broken })
			);
			await page.goto('/my-quizzes');
			await page.waitForLoadState('networkidle');
			await page
				.getByRole('link', { name: /create a quiz/i })
				.first()
				.click();
			const dialog = page.getByRole('dialog');
			await dialog.waitFor();
			const shot = (n: string) =>
				page.screenshot({ path: `${OUT}/${theme}-${s.name}-${n}.png` });
			await shot('1-choose');
			await dialog.getByRole('button', { name: /import from excel/i }).click();
			await shot('2-upload');
			const file = {
				name: 'quiz.xlsx',
				mimeType: 'application/octet-stream',
				buffer: Buffer.from('x')
			};
			await dialog.locator('input[type=file]').setInputFiles(file);
			await dialog.getByText(/things to fix/).waitFor();
			await shot('3-errors');
			mode = 'clean';
			await dialog.getByRole('button', { name: /choose another/i }).click();
			await dialog.locator('input[type=file]').setInputFiles(file);
			await dialog.getByRole('button', { name: /create quiz/i }).waitFor();
			await shot('4-ready');
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth > document.documentElement.clientWidth
			);
			if (overflow) throw new Error('horizontal overflow');
			await context.close();
		});
	}
}
