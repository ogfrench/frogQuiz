// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// Loads the Netlify server function that `NETLIFY=true pnpm run build` writes, and renders
// a few pages through it, the way Netlify does for every page request. #76 passed every
// other check and still took production down: on Netlify's runtime, sanitize-html
// require()d an ES module and the function crashed on load. Run it with
// `node --no-experimental-require-module`, which refuses that require() as Netlify did.
// The API is not running here, so loads that call it fail and fall back, and /create
// answers with its deliberate 503 outage page. What this catches is a crash: a thrown
// error or SvelteKit's 500 for an unhandled one.

import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const entry = '.netlify/functions-internal/sveltekit-render.mjs';
if (!existsSync(entry)) {
	console.error(`${entry} is missing: build with NETLIFY=true first.`);
	process.exit(1);
}

async function main() {
	// The function reads its server files relative to the frontend directory, as on Netlify.
	const { default: handler } = await import(pathToFileURL(entry).href);
	const pages = ['/', '/explore', '/play', '/create'];
	let failed = false;
	for (const path of pages) {
		const request = new Request(`http://localhost${path}`, {
			headers: { accept: 'text/html' }
		});
		let status;
		let detail = '';
		try {
			const response = await handler(request, {});
			status = response.status;
			if (status === 500) detail = (await response.text()).slice(0, 300);
		} catch (error) {
			status = 'threw';
			detail = String(error?.stack ?? error).slice(0, 600);
		}
		const ok = typeof status === 'number' && status !== 500;
		if (!ok) failed = true;
		console.log(`${ok ? 'ok  ' : 'FAIL'} ${path} ${status}${detail ? `\n${detail}` : ''}`);
	}
	return failed;
}

main().then(
	(failed) => process.exit(failed ? 1 : 0),
	(error) => {
		console.error(error);
		process.exit(1);
	}
);
