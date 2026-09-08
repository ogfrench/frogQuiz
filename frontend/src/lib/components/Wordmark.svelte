<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	// The mark spends the frogConvert rainbow once, here, so every other surface
	// can stay neutral. Replaces the Marck Script cursive wordmark.
	interface Props {
		/** Mark size in px. The wordmark scales with the surrounding font-size. */
		size?: number;
		showText?: boolean;
		class?: string;
	}

	let { size = 28, showText = true, class: className = '' }: Props = $props();

	// One gradient id per instance, so two lockups on a page don't collide.
	const gid = `fq-mark-${Math.random().toString(36).slice(2, 9)}`;
</script>

<span class="inline-flex items-center gap-2.5 {className}">
	<svg
		width={size}
		height={size}
		viewBox="0 0 32 32"
		fill="none"
		aria-hidden="true"
		class="shrink-0"
	>
		<defs>
			<linearGradient id={gid} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
				<stop offset="0" stop-color="#ff6b6b" />
				<stop offset="0.22" stop-color="#ffb347" />
				<stop offset="0.4" stop-color="#ffd93d" />
				<stop offset="0.58" stop-color="#6bcf7f" />
				<stop offset="0.76" stop-color="#4fc3f7" />
				<stop offset="1" stop-color="#9775fa" />
			</linearGradient>
		</defs>
		<rect width="32" height="32" rx="9" fill="url(#{gid})" />
		<!-- A quiz mark: the counter of a question mark, cut as a lily pad notch. -->
		<path
			d="M11.4 12.1a4.7 4.7 0 0 1 9.2 1.5c0 3-3.4 3.4-3.4 5.8"
			stroke="#fff"
			stroke-width="2.6"
			stroke-linecap="round"
			fill="none"
		/>
		<circle cx="17.2" cy="23.4" r="1.75" fill="#fff" />
	</svg>
	{#if showText}
		<span class="text-[1.0625em] leading-none font-semibold tracking-[-0.03em]">frogQuiz</span>
	{/if}
</span>
