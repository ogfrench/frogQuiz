<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import '../app.css';
	import Navbar from '$lib/navbar.svelte';
	import { pathname } from '$lib/stores';
	import { navbarVisible } from '$lib/stores.svelte';

	import { initLocalizationContext } from '$lib/i18n';
	import { browser } from '$app/environment';
	import CommandPalette from '$lib/components/commandpalette.svelte';
	import AmbientBackground from '$lib/components/AmbientBackground.svelte';
	interface Props {
		children?: import('svelte').Snippet;
	}

	let { children }: Props = $props();

	if (browser) {
		pathname.set(window.location.pathname);
		if (
			localStorage.theme === 'dark' ||
			(!('theme' in localStorage) &&
				window.matchMedia('(prefers-color-scheme: dark)').matches)
		) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}
	let start_language = 'en';
	const rtl_languages = ['he', 'prs', 'ps'];
	if (browser) {
		start_language = localStorage.getItem('language') ?? 'en';
		document.documentElement.lang = start_language;
		document.documentElement.dir = rtl_languages.includes(start_language) ? 'rtl' : 'ltr';
	}
	initLocalizationContext(start_language);
</script>

<AmbientBackground />

{#if navbarVisible.visible}
	<Navbar />
	<div class="pt-16">
		<div class="z-40"></div>
	</div>
{/if}
{@render children?.()}
<CommandPalette />

<style lang="scss">
	// The page ground now comes from the shadcn `--background` token, applied to
	// `html` in app.css. The old #d6edc9 / #4e6e58 greens lived here.
	:global(html.dark) {
		:global(#pips-slider) {
			--pip: white;
			--pip-active: white;
		}
	}

	@keyframes background_animation {
		0% {
			background-position: 0% 50%;
		}
		50% {
			background-position: 100% 50%;
		}
		100% {
			background-position: 0% 50%;
		}
	}
</style>
