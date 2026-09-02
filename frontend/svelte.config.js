// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
//
// SPDX-License-Identifier: MPL-2.0

import adapter_node from '@sveltejs/adapter-node';
import adapter_netlify from '@sveltejs/adapter-netlify';
import preprocess from 'svelte-preprocess';
import { mdsvex } from 'mdsvex';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	preprocess: [
		preprocess({
			postcss: true
		}),
		mdsvex()
	],
	extensions: ['.svelte', '.svx'],

	kit: {
		// Netlify sets NETLIFY=true during builds; everywhere else (Docker) keeps adapter-node.
		adapter: process.env.NETLIFY
			? adapter_netlify()
			: adapter_node({
					out: 'build',
					precompress: true
				})
		// +++ SOON OBSOLETE +++
		/*
		vite: {
			optimizeDeps: {
				include: ['swiper']
			},
			build: {
				sourcemap: true
			}
		}
		*/
		// --- SOON OBSOLETE ---
	}
};

export default config;
