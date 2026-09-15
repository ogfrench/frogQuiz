<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	// Imported here rather than via `@import` in app.css on purpose. Tailwind v4's
	// processor inlines an @import's text but leaves its relative url(files/...)
	// references alone, so Vite never saw the .woff2 files as dependencies: it
	// emitted none of them, every font request 404'd, and the app silently
	// rendered in whatever `sans-serif` meant on that OS. Importing from the module
	// graph puts the stylesheet through Vite's own CSS pipeline, which rewrites the
	// urls and emits the files. Verified by `document.fonts.check`.
	import '@fontsource-variable/inter';
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
	initLocalizationContext();
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
