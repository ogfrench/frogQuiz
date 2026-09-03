// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
//
// SPDX-License-Identifier: MPL-2.0

const { defineConfig, globalIgnores } = require('eslint/config');

const tsParser = require('@typescript-eslint/parser');
const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const globals = require('globals');
const js = require('@eslint/js');
const svelte = require('eslint-plugin-svelte');

module.exports = defineConfig([
	js.configs.recommended,
	svelte.configs.recommended,
	// Generated output. Linting it produces thousands of errors nobody can act on,
	// and it is absent from a fresh CI checkout, so local runs disagreed with CI.
	globalIgnores(['**/*.cjs', 'src/app.html', 'build/**', '.netlify/**', '.svelte-kit/**']),
	{
		languageOptions: {
			sourceType: 'module',
			ecmaVersion: 2020,

			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	{
		files: ['**/*.{ts,js}'],
		languageOptions: {
			parser: tsParser
		},

		plugins: {
			'@typescript-eslint': typescriptEslint
		},

		rules: {
			// The TypeScript versions below supersede these two: the base rules
			// double-reported every finding and flagged types and runes as undefined.
			'no-unused-vars': 'off',
			'no-undef': 'off',

			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_.*'
				}
			]
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: tsParser,
				extraFileExtensions: ['.svelte']
			}
		}
	},
	{
		files: ['**/*.svelte', '**/*.ts', '**/*.js'],

		rules: {
			'a11y-click-events-have-key-events': 'off',
			'no-unused-vars': 'off',
			'no-undef': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_.*'
				}
			],
			// resolve() exists to prepend kit.paths.base, which this app does not set,
			// so every link it flags is already correct. Turn this back on if a base
			// path is ever configured in svelte.config.js.
			'svelte/no-navigation-without-resolve': 'off',
			'svelte/no-at-html-tags': 'warn',
			'svelte/require-each-key': 'warn'
		},

		plugins: {
			'@typescript-eslint': typescriptEslint
		}
	}
]);
