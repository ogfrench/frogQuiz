<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<!-- The signed-in person as a circle with the first letter of their username: the
     navbar's way to My Account, and the picture on that page. It replaced the random
     cartoon face upstream generates at sign-up, which handed everyone a skin tone,
     hair and clothes they never chose and could not change (François, 2026-10-03).
     Until the name is known, a neutral person glyph holds the same space. -->
<script lang="ts">
	import UserRound from '@lucide/svelte/icons/user-round';

	let { name = null, class: className = '' }: { name?: string | null; class?: string } = $props();

	const initial = $derived(name?.trim().charAt(0).toUpperCase() ?? '');
</script>

<span
	class="bg-muted text-foreground border-border inline-flex shrink-0 items-center justify-center rounded-full border font-semibold select-none {className}"
	aria-hidden="true"
>
	{#if initial}
		{initial}
	{:else}
		<UserRound class="text-muted-foreground size-[55%]" />
	{/if}
</span>
