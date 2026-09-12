<!--
SPDX-FileCopyrightText: 2026 FrogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	// The four classic answer shapes: triangle, diamond, circle, square.
	// Drawn inline rather than loaded as images so they inherit currentColor and
	// keep contrast against whatever colour the answer tile is.
	interface Props {
		index: number;
		class?: string;
		style?: string;
	}

	let { index, class: className = '', style = '' }: Props = $props();

	const paths = [
		'M32 8 L58 54 H6 Z', // triangle
		'M32 4 L60 32 L32 60 L4 32 Z', // diamond
		'', // circle, drawn as a <circle>
		'M8 8 H56 V56 H8 Z' // square
	];
</script>

<svg
	class={className}
	{style}
	viewBox="0 0 64 64"
	fill="currentColor"
	aria-hidden="true"
	focusable="false"
	xmlns="http://www.w3.org/2000/svg"
>
	{#if index % 4 === 2}
		<circle cx="32" cy="32" r="26" />
	{:else}
		<path d={paths[index % 4]} stroke="currentColor" stroke-width="4" stroke-linejoin="round" />
	{/if}
</svg>
