<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<!-- The signed-in person as a circle with their frog: the navbar's way to My Account, and
     the picture on that page. The frog is the one they picked on My Account, else the one
     their username gives them (account_frog.svelte.ts). It replaced a circle with the first
     letter of the username, which replaced the random cartoon face upstream generates at
     sign-up (François, 2026-10-03). Until the name is known, a neutral person glyph holds
     the same space. -->
<script lang="ts">
	import UserRound from '@lucide/svelte/icons/user-round';
	import { frogFor, frogUrl } from '$lib/account_frog.svelte';

	let { name = null, class: className = '' }: { name?: string | null; class?: string } = $props();

	const frog = $derived(frogFor(name));
	const src = $derived(frog ? frogUrl(frog) : undefined);
</script>

<span
	class="bg-muted text-foreground border-border inline-flex shrink-0 items-center justify-center rounded-full border font-semibold select-none {className}"
	aria-hidden="true"
>
	{#if src}
		<img {src} alt="" class="size-full rounded-full object-contain p-[9%]" />
	{:else}
		<UserRound class="text-muted-foreground size-[55%]" />
	{/if}
</span>
