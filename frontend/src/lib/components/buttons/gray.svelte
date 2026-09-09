<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	// Was hardcoded gray-50/gray-700. Now the shadcn secondary button; the prop
	// API is unchanged so all call sites still work.
	import { Button } from '$lib/components/ui/button/index.js';

	interface Props {
		disabled?: boolean;
		flex?: boolean;
		href?: undefined | string;
		target?: undefined | string;
		type?: 'button' | 'submit' | 'reset';
		children?: import('svelte').Snippet;
		onclick?: (event: MouseEvent) => void;
	}

	let {
		disabled = false,
		// ponytail: no-op, see brown.svelte.
		flex = false,
		href = undefined,
		target = '_self',
		type = 'button',
		children,
		onclick
	}: Props = $props();
</script>

{#if href}
	<Button variant="secondary" {href} {target} {disabled} {onclick} class="w-full">
		{@render children?.()}
	</Button>
{:else}
	<Button variant="secondary" {type} {disabled} {onclick} class="w-full">
		{@render children?.()}
	</Button>
{/if}
