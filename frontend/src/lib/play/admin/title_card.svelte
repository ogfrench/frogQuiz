<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { getLocalization } from '$lib/i18n';
	import { sanitizeTitleHtml } from '$lib/sanitize';
	import Wordmark from '$lib/components/Wordmark.svelte';
	import { sfx } from '$lib/play/sfx';
	import { onMount } from 'svelte';

	interface Props {
		title: string;
		description: string;
		cover_image?: string | null;
		questions: number;
		players: number;
	}

	let { title, description, cover_image = null, questions, players }: Props = $props();
	const { t } = getLocalization();

	// Three blips and a go, as the card fills its "Get ready" bar.
	onMount(() => {
		sfx('getready');
	});
</script>

<!-- The title card before question 1 (François, 12 Oct, over a countdown and a crowd of
     frogs). The title arrives, then the facts of the game, then a bar fills as "Get
     ready". The host still presses Next: the bar only sets the mood. There is no time
     estimate, because nothing here knows how long a game will run. The bar is the mark's
     gradient, an exception to spending the rainbow once (CLAUDE.md). -->
<div class="fq-stage justify-center">
	<span class="card-in"><Wordmark size={64} showText={false} /></span>
	<!-- wrap-anywhere, as on the question screen: a title or description saved with no
	     spaces ran 764px off the projector here (11 Oct). -->
	<h1
		class="card-title max-w-5xl text-center text-6xl font-bold tracking-[-0.04em] text-balance wrap-anywhere md:text-7xl"
	>
		{@html sanitizeTitleHtml(title)}
	</h1>
	{#if description}
		<p
			class="card-later text-muted-foreground max-w-3xl text-center text-2xl text-balance wrap-anywhere md:text-3xl"
		>
			{description}
		</p>
	{/if}
	<div class="card-later flex flex-wrap justify-center gap-3" style="animation-delay: 0.7s">
		<span
			class="border-border bg-card rounded-full border px-5 py-2 text-lg font-medium md:text-xl"
		>
			{$t('words.question_count', { count: questions })}
		</span>
		<span
			class="border-border bg-card rounded-full border px-5 py-2 text-lg font-medium md:text-xl"
		>
			{$t('admin_page.player_count', { count: players })}
		</span>
	</div>
	{#if cover_image}
		<div class="card-later h-[24vh]" style="animation-delay: 0.8s">
			<img
				class="block max-h-full max-w-full rounded-xl"
				src="/api/v1/storage/download/{cover_image}"
				alt=""
			/>
		</div>
	{/if}
	<div class="card-later flex flex-col items-center gap-2" style="animation-delay: 0.9s">
		<div class="bg-muted h-2 w-72 overflow-hidden rounded-full md:w-96">
			<div class="ready-fill h-full rounded-full"></div>
		</div>
		<p class="text-muted-foreground text-sm font-medium tracking-[0.2em] uppercase">
			{$t('admin_page.get_ready')}
		</p>
	</div>
</div>

<style>
	.card-title {
		animation: rise 0.6s cubic-bezier(0.2, 1.4, 0.4, 1) both;
	}
	.card-in {
		animation: rise 0.5s cubic-bezier(0.2, 1.4, 0.4, 1) both;
	}
	.card-later {
		animation: fade 0.5s 0.5s both;
	}
	.ready-fill {
		background: linear-gradient(
			90deg,
			#ff6b6b,
			#ffb347,
			#ffd93d,
			#6bcf7f,
			#4fc3f7,
			#9775fa,
			#ff6b9d
		);
		transform-origin: left;
		animation: fill 5s 1s linear both;
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(1.5rem) scale(0.92);
		}
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	@keyframes fill {
		from {
			transform: scaleX(0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.card-title,
		.card-in,
		.card-later,
		.ready-fill {
			animation: none;
		}
	}
</style>
