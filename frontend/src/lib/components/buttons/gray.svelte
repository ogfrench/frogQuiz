<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	// Was hardcoded gray-50/gray-700. Now the shadcn secondary button; the prop
	// API is unchanged so all call sites still work.
	import { Button, type ButtonProps } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';

	interface Props {
		disabled?: boolean;
		flex?: boolean;
		href?: undefined | string;
		target?: undefined | string;
		type?: 'button' | 'submit' | 'reset';
		/** Accessible name. Required when the button's only content is an icon. */
		label?: undefined | string;
		/** Overrides the default `w-full`; merged, so `class="w-auto"` wins. */
		class?: string;
		variant?: ButtonProps['variant'];
		size?: ButtonProps['size'];
		children?: import('svelte').Snippet;
		onclick?: (event: MouseEvent) => void;
	}

	let {
		disabled = false,
		// No-op, see brown.svelte.
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		flex = false,
		href = undefined,
		target = '_self',
		type = 'button',
		label = undefined,
		// `w-full` stays the default so the existing call sites are unchanged; passing
		// `class` merges over it rather than adding to it.
		class: className = undefined,
		variant = 'secondary',
		size = undefined,
		children,
		onclick
	}: Props = $props();

	const classes = $derived(cn('w-full', className));
</script>

{#if href}
	<Button {variant} {size} {href} {target} {disabled} {onclick} aria-label={label} class={classes}>
		{@render children?.()}
	</Button>
{:else}
	<Button {variant} {size} {type} {disabled} {onclick} aria-label={label} class={classes}>
		{@render children?.()}
	</Button>
{/if}
