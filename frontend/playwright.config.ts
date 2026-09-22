// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { defineConfig } from '@playwright/test';

// Drives the Edge already installed on Windows (channel: 'msedge'), so no browser
// download is needed. The app stack is started by e2e/run.sh at the repo root, not
// here: it needs Postgres, Redis and Meilisearch up first.
//
// Specs are named *.e2e.ts because vitest's default include would otherwise pick up
// *.spec.ts and try to run them without a browser.
export default defineConfig({
	testDir: './e2e',
	testMatch: '**/*.e2e.ts',
	globalSetup: './e2e/global-setup.ts',
	outputDir: '../e2e/.data/playwright',
	fullyParallel: false,
	workers: 1,
	retries: 0,
	timeout: 60_000,
	expect: { timeout: 10_000 },
	reporter: [['list'], ['html', { outputFolder: '../e2e/.data/report', open: 'never' }]],
	use: {
		baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
		channel: 'msedge',
		headless: true,
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure'
	}
});
