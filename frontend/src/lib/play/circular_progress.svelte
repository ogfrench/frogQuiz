<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	interface Props {
		progress: number;
		text: string;
		color: string;
		/** Any CSS length. The phones keep 120px; the projector passes a larger, fluid one. */
		size?: string;
	}

	let { progress, text, color, size = '120px' }: Props = $props();
	let angle = $derived(360 * progress);

	// Theme tokens rather than white, gainsboro and black: in dark mode the hardcoded white
	// disc sat on the phone like a sticker. The disc is the page ground, the time left is
	// the muted token, and the number is the foreground.
	// No trailing `;`: `style:` sets the first value through the attribute, which shrugs
	// it off, and every later one through setProperty, which rejects the whole value. The
	// ring then froze on its first frame while the number kept counting.
	let background = $derived(`radial-gradient(var(--background) 58%, transparent 59%),
	    conic-gradient(transparent 0deg ${angle}deg, var(--muted) ${angle}deg 360deg),
	    conic-gradient(${color} 0deg, ${color} 360deg)`);
</script>

<div
	id="progress-circle"
	style:--background-ring={background}
	style:--size={size}
	class="text-foreground rounded-full font-semibold tabular-nums transition-all"
>
	{text}
</div>

<style>
	#progress-circle {
		background: var(--background-ring);
		width: var(--size);
		height: var(--size);
		/* The number scales with the ring: a third of its width. */
		font-size: calc(var(--size) / 3);
		transition: all 500ms ease-in;
		will-change: transform;
		display: flex;
		justify-content: center;
		align-items: center;
	}
</style>
