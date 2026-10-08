<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Avatar from '$lib/components/ui/avatar';
	import { frogFor } from '$lib/play/avatars.svelte';
	import { cn } from '$lib/utils';

	interface Props {
		/** The player's username: their frog is looked up from it. */
		name: string;
		class?: string;
		/** An Avatar.Badge, if the avatar carries one. */
		children?: Snippet;
	}

	let { name, class: className, children }: Props = $props();

	const frog = $derived(frogFor(name));
	// The first character, not the first UTF-16 unit: an emoji nickname is two of those.
	const initial = $derived(Array.from(name.trim())[0]?.toUpperCase() ?? '');
</script>

<!-- Decorative: the name is always printed beside it, so a screen reader would only
     hear it twice. -->
<Avatar.Root class={cn('bg-muted text-muted-foreground @container size-10', className)} aria-hidden="true">
	{#if frog}
		<!-- Padding inside the circle: the art is square, and a hat or a raised hand in a
		     corner is cut off by the round mask without it. The colour is the frog's own:
		     once the poses run out, the same set comes round again in another hue. -->
		<Avatar.Image
			src={frog.src}
			alt=""
			class="object-contain p-[6%]"
			style={frog.hue ? `filter: hue-rotate(${frog.hue}deg)` : undefined}
		/>
	{/if}
	<!-- Sized to the circle, not the text around it: the same component is 32px in the
	     lobby and 112px on the podium. Ground and ink come from the root, so one class on
	     the component recolors both. -->
	<Avatar.Fallback class="bg-transparent text-[40cqw] font-semibold text-inherit">{initial}</Avatar.Fallback>
	{@render children?.()}
</Avatar.Root>
