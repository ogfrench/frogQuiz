// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { sveltekit } from '@sveltejs/kit/vite';

const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8000';

/** @type {import("vite").UserConfig} */
const config = {
	plugins: [
		sveltekit(),
		{
			name: 'configure-response-headers',
			configureServer: (server) => {
				server.middlewares.use((_req, res, next) => {
					/*        res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        res.setHeader("Access-Control-Allow-Origin", "https://ncs3.classquiz.de");*/
					next();
				});
			}
		}
	],
	server: {
		port: 3000,
		// Without this the dev server cannot reach the API at all, and every local run
		// needs the same proxy hand-wired back in. The backend is expected on 8000
		// (`uvicorn frogquiz:app --port 8000`); nothing here affects the built app,
		// which is served behind Caddy and never sees Vite.
		//
		// API_PROXY_TARGET overrides it, for working on the frontend without a local
		// backend -- the data-driven routes otherwise 500 and there is nothing to look
		// at. Pointing it at a deployed environment means every request you make is a
		// real one, so treat that as read-only: creating, editing or deleting through it
		// writes to that environment's database.
		proxy: {
			'/api': { target: API_PROXY_TARGET, changeOrigin: true },
			'/socket.io': { target: API_PROXY_TARGET, ws: true, changeOrigin: true }
		}
	},
	preview: {
		port: 3000
	},
	optimizeDeps: {
		// svelte-range-slider-pips ships Svelte only, which the scan below leaves alone,
		// so it was still found late and reloaded the page once. Name it outright.
		include: ['swiper', 'tippy.js', 'svelte-range-slider-pips'],
		// Dev server only. Vite pre-bundles the dependencies its start-up scan finds and
		// bundles the rest on demand, reloading the page under the user each time: five
		// reloads in two minutes of ordinary use. SvelteKit points the scan at the routes,
		// but the scan reads only <script> blocks, and the editor and the game load their
		// heavy parts with `{#await import(...)}` in markup -- so CKEditor, Uppy and the
		// game screens were never seen. Scanning every component directly finds them.
		// (A hand-kept include list and server.warmup were both tried first; each still
		// reloaded once.) Setting this replaces SvelteKit's own entries rather than adding
		// to them, so the first two lines restate SvelteKit's; without them the routes'
		// own imports went unscanned and reloaded instead.
		entries: [
			'src/routes/**/+*.{svelte,js,ts}',
			'!src/routes/**/+*server.*',
			'src/lib/**/*.svelte'
		]
	},
	build: {
		sourcemap: true
	}

	/* Trying

	ssr: {
		noExternal: ['@ckeditor/*'],
	}

 end trying*/
};

export default config;
