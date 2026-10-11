<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

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
	import Footer from '$lib/footer.svelte';
	import { page } from '$app/state';

	import { initLocalizationContext } from '$lib/i18n';
	import { browser } from '$app/environment';
	import CommandPalette from '$lib/components/commandpalette.svelte';
	import AmbientBackground from '$lib/components/AmbientBackground.svelte';
	interface Props {
		children?: import('svelte').Snippet;
	}

	let { children }: Props = $props();

	// The screens that take the whole viewport: the editor and the live game. Worked out
	// from the route on every navigation. It used to be a global flag that 21 pages each
	// had to set as they loaded, and a page that did not inherited whatever the last one
	// left -- one list here instead of a rule every new page has to remember.
	const FULLSCREEN_ROUTES = new Set([
		'/play',
		'/admin',
		'/create',
		'/edit',
		'/edit/videos',
		'/remote'
	]);
	// An error page keeps the navigation, whatever route it was raised on: a failed load of
	// /edit used to show the error with no navbar and no footer.
	const chrome = $derived(page.error != null || !FULLSCREEN_ROUTES.has(page.route.id ?? ''));

	if (browser) {
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

<!-- One structure for every page: skip link, navbar, main, footer. There was no <main>
     anywhere, so a screen-reader user had no landmark to jump to, and the footer was
     pasted into four pages and missing from the rest (Discover, a quiz, My Account,
     the 404). Screens that hide the navbar -- the editor and the game -- hide the
     footer with it. -->
<a
	href="#main-content"
	class="bg-background text-foreground focus-visible:ring-ring sr-only z-50 rounded-md px-4 py-2 text-sm font-medium shadow-md focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus-visible:ring-2"
	>Skip to content</a
>
<div class="flex min-h-dvh flex-col">
	{#if chrome}
		<Navbar />
		<div class="h-16 shrink-0"></div>
	{/if}
	<main id="main-content" tabindex="-1" class="flex-1 outline-none">
		{@render children?.()}
	</main>
	{#if chrome}
		<Footer />
	{/if}
</div>
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
