// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { sveltekit } from '@sveltejs/kit/vite';

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
		proxy: {
			'/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
			'/socket.io': { target: 'http://127.0.0.1:8000', ws: true, changeOrigin: true }
		}
	},
	preview: {
		port: 3000
	},
	optimizeDeps: {
		include: ['swiper', 'tippy.js']
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
