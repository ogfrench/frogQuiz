// SPDX-FileCopyrightText: 2026 frogQuiz contributors
// SPDX-License-Identifier: MPL-2.0
import { expect, test } from '@playwright/test';

test('service banner recovers without losing an open editor', async ({ page }) => {
	let down = true;
	await page.route('**/api/v1/health', (route) =>
		route.fulfill({ status: down ? 503 : 200, json: { status: down ? 'down' : 'ok' } })
	);
	await page.goto('/create');
	const title = page.getByRole('textbox', { name: 'Quiz title' });
	await title.fill('Unsaved outage check');
	await expect(page.getByTestId('service-banner')).toBeVisible();
	down = false;
	await page.getByRole('button', { name: 'Check connection' }).click();
	await expect(page.getByTestId('service-banner')).toHaveCount(0);
	await expect(title).toHaveText('Unsaved outage check');
});

test('Discover reports an examples outage and retries successfully', async ({ page }) => {
	let down = true;
	await page.route('**/api/v1/quiz/examples', (route) =>
		route.fulfill({
			status: down ? 503 : 200,
			json: down
				? {}
				: {
						username: null,
						quizzes: [
							{
								id: 'outage-test',
								title: 'Recovered example',
								description: '',
								questions: 2
							}
						]
					}
		})
	);
	await page.goto('/');
	await page.getByRole('link', { name: 'Discover', exact: true }).first().click();
	await expect(
		page.getByText('We couldn’t load example quizzes. Please try again.')
	).toBeVisible();
	down = false;
	await page.getByRole('button', { name: 'Retry', exact: true }).click();
	await expect(page.getByText('Recovered example')).toBeVisible();
	await expect(page.getByText('We couldn’t load example quizzes. Please try again.')).toHaveCount(
		0
	);
});
