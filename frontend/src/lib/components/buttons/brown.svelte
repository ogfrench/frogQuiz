<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	// Was a hardcoded #B07156 brown inherited from upstream. Now the shadcn
	// primary button; the prop API is unchanged so all call sites still work.
	import { Button } from '$lib/components/ui/button/index.js';

	interface Props {
		disabled?: boolean;
		flex?: boolean;
		href?: undefined | string;
		target?: undefined | string;
		type?: 'button' | 'submit' | 'reset';
		/** Accessible name. Required when the button's only content is an icon. */
		label?: undefined | string;
		children?: import('svelte').Snippet;
		onclick?: (event: MouseEvent) => void;
	}

	let {
		disabled = false,
		// ponytail: `flex` is a no-op now — the shadcn button is already a centred
		// flex row. Kept so the 25 existing call sites don't need touching.
		flex = false,
		href = undefined,
		target = '_self',
		type = 'button',
		label = undefined,
		children,
		onclick
	}: Props = $props();
</script>

{#if href}
	<Button {href} {target} {disabled} {onclick} aria-label={label} class="w-full">
		{@render children?.()}
	</Button>
{:else}
	<Button {type} {disabled} {onclick} aria-label={label} class="w-full">
		{@render children?.()}
	</Button>
{/if}
