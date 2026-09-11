<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 FrogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { onMount } from 'svelte';
	import { getLocalization } from '$lib/i18n';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import confetti from 'canvas-confetti';

	const { t } = getLocalization();

	interface Props {
		data: any;
		username?: any;
		show_final_results: boolean;
	}

	let { data = $bindable(), username, show_final_results }: Props = $props();

	let ranked = $derived(
		Object.keys(data)
			.sort((a, b) => (parseFloat(data[b]) || 0) - (parseFloat(data[a]) || 0))
			.map((name, i) => ({ name, score: parseFloat(data[name]) || 0, place: i + 1 }))
	);

	// Podium reads 2nd, 1st, 3rd left to right, the way a real one does.
	let podium = $derived(
		[ranked[1], ranked[0], ranked[2]].filter(Boolean).map((p) => ({
			...p,
			height: p.place === 1 ? 'h-48' : p.place === 2 ? 'h-36' : 'h-28',
			// Built up from last place to first, so the winner lands last.
			delay: (4 - p.place) * 700
		}))
	);
	let runners_up = $derived(ranked.slice(3, 8));
	let place_label = (place: number) =>
		place === 1
			? $t('play_page.1st_place')
			: place === 2
				? $t('play_page.2nd_place')
				: $t('play_page.3rd place');

	let canvas: HTMLCanvasElement = $state();
	onMount(() => {
		const winner_lands = 3 * 700 + 400;
		setTimeout(() => {
			confetti.create(canvas, { resize: true, useWorker: true });
			confetti({ particleCount: 200, spread: 160 });
		}, winner_lands);
	});
</script>

{#if show_final_results}
	<canvas bind:this={canvas} class="pointer-events-none fixed inset-0 z-50 h-full w-full"></canvas>

	<div class="flex min-h-[calc(100vh-4rem)] w-full flex-col items-center justify-center gap-10 px-6 pb-10 pt-20">
		<!-- The blocks need a floor, or they read as floating cards rather than a
		     podium. The rule under them is that floor. -->
		<div
			class="flex w-full max-w-4xl items-end justify-center gap-4 border-b-2 border-border px-8 sm:gap-6"
		>
			{#each podium as p (p.name)}
				<div class="flex min-w-0 flex-1 flex-col items-center gap-3">
					<div
						class="flex w-full min-w-0 flex-col items-center gap-0.5 text-center"
						in:fly|global={{ y: -40, duration: 500, delay: p.delay, easing: cubicOut }}
					>
						<p
							class="w-full truncate text-xl font-semibold tracking-tight sm:text-2xl"
							title={p.name}
						>
							{p.name}
						</p>
						<p class="text-sm text-muted-foreground tabular-nums">
							{p.score}
							{$t('words.point_plural')}
						</p>
					</div>

					<div
						class="podium-block flex w-full {p.height} flex-col items-center justify-start gap-1
							rounded-t-2xl border border-b-0 border-border pt-3 -mb-[2px]"
						class:is-winner={p.place === 1}
						in:fly|global={{ y: 120, duration: 600, delay: p.delay, easing: cubicOut }}
					>
						<span class="text-3xl font-bold tabular-nums sm:text-4xl">{p.place}</span>
						<span
							class="px-1 text-center text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground"
						>
							{place_label(p.place)}
						</span>
					</div>
				</div>
			{/each}
		</div>

		{#if runners_up.length}
			<ul
				class="w-full max-w-md divide-y divide-border overflow-hidden rounded-xl border border-border bg-card"
				in:fade|global={{ duration: 400, delay: 3 * 700 + 600 }}
			>
				{#each runners_up as p (p.name)}
					<li class="flex items-center gap-3 px-4 py-2.5">
						<span class="w-6 text-sm font-semibold text-muted-foreground tabular-nums"
							>{p.place}</span
						>
						<span class="min-w-0 flex-1 truncate font-medium" title={p.name}>{p.name}</span>
						<span class="text-sm text-muted-foreground tabular-nums">{p.score}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	{#if data[username]}
		{@const me = ranked.find((p) => p.name === username)}
		<div class="fixed bottom-0 left-0 mb-6 flex w-full justify-center px-4">
			<div
				class="flex items-center gap-4 rounded-full border border-border bg-card/90 px-5 py-2.5 shadow-lg backdrop-blur"
			>
				<p class="text-sm font-medium tabular-nums">
					{$t('play_page.your_score', { score: data[username] })}
				</p>
				{#if me}
					<span class="h-4 w-px bg-border" aria-hidden="true"></span>
					<p class="text-sm text-muted-foreground tabular-nums">
						{$t('play_page.your_place', { place: me.place })}
					</p>
				{/if}
			</div>
		</div>
	{/if}
{/if}

<style>
	.podium-block {
		background: linear-gradient(to bottom, var(--muted), var(--card));
	}

	/* The winner's block is the one thing on this screen that should feel loud. */
	.podium-block.is-winner {
		background: linear-gradient(to bottom, var(--primary), var(--primary));
		color: var(--primary-foreground);
		box-shadow: 0 -8px 30px -12px var(--primary);
	}

	.podium-block.is-winner :global(span) {
		color: var(--primary-foreground);
	}
</style>
