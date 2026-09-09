<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	interface Props {
		languages?: Array<{
			flag: string;
			name: string;
			code: string;
		}>;
	}

	let {
		languages = [
			{
				code: 'de',
				name: 'Deutsch',
				flag: '🇩🇪'
			},
			{
				code: 'en',
				name: 'English',
				flag: '🇬🇧'
			},
			{
				code: 'tr',
				name: 'Türkçe',
				flag: '🇹🇷'
			},
			{
				code: 'fr',
				name: 'Français',
				flag: '🇫🇷'
			},
			{
				code: 'id',
				name: 'Bahasa Indonesia',
				flag: '🇮🇩'
			},
			{
				code: 'ca',
				name: 'Català',
				flag: '🇪🇸'
			},
			{
				code: 'it',
				name: 'Italiano',
				flag: '🇮🇹'
			},
			{
				code: 'es',
				name: 'Español',
				flag: '🇪🇸'
			},
			{
				code: 'nb_NO',
				name: 'Norsk',
				flag: '🇳🇴'
			},
			{
				code: 'zh_Hant',
				name: '繁體中文',
				flag: '🇹🇼'
			},
			{
				code: 'pl',
				name: 'Polski',
				flag: '🇵🇱'
			},
			{
				code: 'pt',
				name: 'Português',
				flag: '🇵🇹'
			},
			{
				code: 'uk',
				name: 'Українська',
				flag: '🇺🇦'
			},
			{
				code: 'nl',
				name: 'Nederlands',
				flag: '🇳🇱'
			},
			{
				code: 'hu',
				name: 'Magyar',
				flag: '🇭🇺'
			},
			{
				code: 'vi',
				name: 'tiếng Việt',
				flag: '🇻🇳'
			},
			{
				code: 'ta',
				flag: '🇮🇳',
				name: 'தமிழ்'
			},
			{
				code: 'pt_BR',
				flag: '🇧🇷',
				name: 'Português (Brasil)'
			},
			{
				code: 'ja',
				flag: '🇯🇵',
				name: '日本語'
			},
			{
				code: 'he',
				flag: '🇮🇱',
				name: 'עברית'
			},
			{
				code: 'prs',
				flag: '🇦🇫',
				name: 'دری (Dari)'
			},
			{
				code: 'ps',
				flag: '🇦🇫',
				name: "Pax̌tó"
			}
		]
	}: Props = $props();
	const get_selected_language = (): string => {
		return localStorage.getItem('language');
	};
	let selected_language: string = $state();
	onMount(() => {
		selected_language = get_selected_language();
	});

	const set_language = (code: string): void => {
		if (browser) {
			localStorage.setItem('language', code);
			window.location.reload();
		}
	};
</script>

<div>
	<select
		bind:value={selected_language}
		onchange={() => {
			set_language(selected_language);
		}}
		class="border-input bg-background text-foreground focus-visible:ring-ring rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
		aria-label="Language-Selector"
	>
		{#each languages as lang}
			<option value={lang.code}>{lang.flag} {lang.name} </option>
		{/each}
	</select>
</div>
