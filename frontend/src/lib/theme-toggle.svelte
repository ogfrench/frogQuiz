<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<!-- The theme switch, as one component.

     It lived inside navbar.svelte as four near-identical copies, which meant it was
     unreachable on any screen that hides the navbar. The editor is exactly that
     screen, and it is the one people sit in longest.

     Switching also used to be `window.location.reload()`. In the editor that is a
     round trip through the unsaved-changes prompt to change a colour. Toggling the
     class the boot script in app.html already looks for does the same job with no
     navigation, so it is safe to offer anywhere. -->
<script lang="ts">
	import { browser } from '$app/environment';
	import Sun from '@lucide/svelte/icons/sun';
	import Moon from '@lucide/svelte/icons/moon';

	let { class: className = '' }: { class?: string } = $props();

	// Read the element the boot script already stamped rather than re-deriving from
	// localStorage: those two can disagree, and the class is what is on screen.
	let dark = $state(browser ? document.documentElement.classList.contains('dark') : false);

	const toggle = () => {
		dark = !dark;
		document.documentElement.classList.toggle('dark', dark);
		try {
			localStorage.setItem('theme', dark ? 'dark' : 'light');
		} catch {
			// Site data can be blocked. The toggle still works for this page view.
		}
	};
</script>

<button
	type="button"
	onclick={toggle}
	aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
	aria-pressed={dark}
	class="fq-touch-target text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring relative inline-flex size-9 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none {className}"
>
	{#if dark}
		<Sun class="size-5" aria-hidden="true" />
	{:else}
		<Moon class="size-5" aria-hidden="true" />
	{/if}
</button>
