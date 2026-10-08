<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { onMount } from 'svelte';
	import { getLocalization } from '$lib/i18n';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { DUR, dur, reduced } from '$lib/motion';
	import confetti from 'canvas-confetti';
	import Crown from '@lucide/svelte/icons/crown';
	import Medal from '@lucide/svelte/icons/medal';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import { buttonVariants } from '$lib/components/ui/button';
	import FrogAvatar from '$lib/components/FrogAvatar.svelte';
	import PodiumMusic from '$lib/play/admin/podium_music.svelte';

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

	// Somebody watching this has just played for five minutes; the podium is the payoff,
	// and it was over in two seconds. Kahoot reveals third, then second, then first with
	// a beat between each, and that beat is the whole effect -- a room reacts to each
	// name. 1.4s apart, so the three reveals run about four seconds in total.
	const REVEAL_GAP_MS = 1400;
	const FIRST_REVEAL_MS = 600;
	const winner_lands = FIRST_REVEAL_MS + 2 * REVEAL_GAP_MS + DUR.stage;

	// Nobody should be made ill by a results screen. With reduced motion the whole
	// podium is simply there, and no confetti is fired.
	// Podium reads 2nd, 1st, 3rd left to right, the way a real one does.
	let podium = $derived(
		[ranked[1], ranked[0], ranked[2]].filter(Boolean).map((p) => ({
			...p,
			// Fixed pixel heights (h-48/h-36/h-28) made the podium a small object adrift
			// in the middle of a projector screen, and 192 vs 144 vs 112 does not read as
			// a rank order from the back of a room. Viewport-relative so the podium scales
			// with the screen it is thrown on, with a floor for short windows.
			height:
				p.place === 1
					? 'h-[22vh] min-h-32 sm:h-[38vh] sm:min-h-44'
					: p.place === 2
						? 'h-[16vh] min-h-24 sm:h-[26vh] sm:min-h-32'
						: 'h-[11vh] min-h-20 sm:h-[18vh] sm:min-h-24',
			// Built up from last place to first, so the winner lands last.
			delay: reduced() ? 0 : FIRST_REVEAL_MS + (3 - p.place) * REVEAL_GAP_MS
		}))
	);
	let runners_up = $derived(ranked.slice(3, 8));
	// Everybody below eighth. Folded away by default: the podium is the moment, and a
	// full ranking is for whoever wants to look for themselves afterwards. On a phone
	// the player's own place is already in the pill at the bottom.
	let the_rest = $derived(ranked.slice(8));
	let show_all = $state(false);
	const medal = (place: number) =>
		place === 1 ? 'is-gold' : place === 2 ? 'is-silver' : 'is-bronze';
	// Only on a player's own screen, and only for the three places that are a place.
	// Ink rather than a filled chip: the pill it sits in is already a surface.
	// The ink is a class, not a hex: it sits on bg-card, which flips with the theme, and
	// one fixed gold was 3.25:1 on white while silver and bronze were under 3.8:1 on the
	// dark card. medal-contrast.test.ts holds all six to AA.
	const MEDALS: Record<number, { ink: string; key: string }> = {
		1: { ink: 'medal-ink-1', key: 'play_page.1st_place' },
		2: { ink: 'medal-ink-2', key: 'play_page.2nd_place' },
		3: { ink: 'medal-ink-3', key: 'play_page.3rd place' }
	};
	let place_label = (place: number) =>
		place === 1
			? $t('play_page.1st_place')
			: place === 2
				? $t('play_page.2nd_place')
				: $t('play_page.3rd place');

	// A block grows up out of the floor line. It used to fly in 160px from below with no
	// clip, so on a projector it rose from the bottom edge of the screen rather than from
	// the podium (Gonçalo, 7 Oct). scaleY is a transform and the fade is opacity, the
	// only two things this app animates (app.css, Motion). The fade is quick, so the
	// block is solid for almost the whole rise.
	function grow(_node: Element, { delay = 0, duration = 0 }) {
		return {
			delay,
			duration,
			easing: cubicOut,
			css: (t: number) =>
				`transform-origin: bottom; transform: scaleY(${t}); opacity: ${Math.min(1, t * 4)}`
		};
	}

	let canvas: HTMLCanvasElement = $state();
	let winner_shown = $state(reduced());
	onMount(() => {
		const timers = [
			setTimeout(() => (winner_shown = true), reduced() ? 0 : winner_lands)
		];
		if (!reduced()) {
			// Two bursts rather than one: a single symmetrical puff reads as a graphic,
			// two from the lower corners reads as a room.
			const fire = () => {
				const shoot = confetti.create(canvas, { resize: true, useWorker: true });
				shoot({ particleCount: 140, spread: 70, angle: 60, origin: { x: 0, y: 0.9 } });
				shoot({ particleCount: 140, spread: 70, angle: 120, origin: { x: 1, y: 0.9 } });
			};
			timers.push(setTimeout(fire, winner_lands));
			timers.push(setTimeout(fire, winner_lands + 600));
		}
		return () => timers.forEach(clearTimeout);
	});
</script>

{#if show_final_results}
	<!-- The host's screen only: it is the room's speaker. A player's phone has `username`;
	     the music starts with the confetti, when the winner lands. -->
	{#if !username}
		<PodiumMusic delay_ms={reduced() ? 0 : winner_lands} />
	{/if}
	<canvas bind:this={canvas} class="pointer-events-none fixed inset-0 z-50 h-full w-full"
	></canvas>

	<div class="fq-stage">
		<h1 class="sr-only">{$t('admin_page.final_results_title')}</h1>
		<!-- The blocks need a floor, or they read as floating cards rather than a
		     podium. border-b-2 border-border was too faint to register as one at
		     projector distance: the blocks looked cut off rather than stood on
		     something. A full-strength rule that runs wider than the blocks reads as
		     ground. -->
		<div
			class="border-foreground/25 flex w-full max-w-4xl items-end justify-center gap-2 border-b-4 px-2 sm:gap-6 sm:px-8"
		>
			{#each podium as p (p.name)}
				<div class="flex min-w-0 flex-1 flex-col items-center gap-3">
					<div
						class="flex w-full min-w-0 flex-col items-center gap-0.5 text-center"
						in:fly|global={{
							y: 12,
							duration: dur(DUR.surface),
							delay: p.delay + dur(DUR.reveal) - dur(DUR.control),
							easing: cubicOut
						}}
					>
						<!-- The winner gets the one piece of ornament on the screen, and it
						     arrives after their block has landed. Its room is held from the
						     start: inserted on arrival, it made the column taller and dropped the
						     whole podium, floor and all, 21px in one frame. -->
						{#if p.place === 1}
							<span class="grid size-8 place-items-center sm:size-10">
								{#if winner_shown}
									<span class="crown" style="color: #e0a92a" in:fade|global={{ duration: dur(DUR.surface) }}>
										<Crown class="size-8 sm:size-10" aria-hidden="true" />
									</span>
								{/if}
							</span>
						{/if}
						<!-- The winner's frog is the largest, as their name is. -->
						<FrogAvatar
							name={p.name}
							class="mb-1 {p.place === 1 ? 'size-20 sm:size-28' : 'size-14 sm:size-20'}"
						/>
						<!-- Kahoot's podium is the recognizable shape, and the winner is the
						     point of it: their name is the largest thing on the screen and their
						     score sits in the gold, rather than all three being labeled the same
						     way and the gold doing all the work. -->
						<p
							class="w-full truncate font-semibold tracking-tight {p.place === 1
								? 'text-3xl sm:text-5xl'
								: 'fq-answer'}"
							title={p.name}
						>
							{p.name}
						</p>
						{#if p.place === 1}
							<span
								class="mt-1 rounded-full px-3 py-1 text-sm font-semibold tabular-nums sm:text-base"
								style="background: #f5c33c; color: #1b1b1f"
							>
								{p.score}
								{$t('words.point', { count: p.score })}
							</span>
						{:else}
							<p class="text-muted-foreground text-sm tabular-nums">
								{p.score}
								{$t('words.point', { count: p.score })}
							</p>
						{/if}
					</div>

					<!-- Gold, silver and bronze rather than the theme's primary. The brand has
					     one accent and the rainbow is spent on the wordmark and the answer
					     bars (CLAUDE.md), but a podium is not branding: medal colors are what
					     a podium means, and the winner's block was otherwise a black slab. -->
					<div
						class="podium-block {medal(p.place)} flex w-full {p.height} flex-col items-center
							justify-start gap-1 rounded-t-2xl border border-b-0 border-border pt-3 -mb-[2px]"
						class:is-winner={p.place === 1}
						in:grow|global={{ duration: dur(DUR.reveal), delay: p.delay }}
					>
						<span class="fq-display font-bold tabular-nums">{p.place}</span>
						<!-- One element, not a visible one plus an sr-only copy of the same
						     words: at sm and up both were in the DOM, so a screen reader read
						     the place twice and `getByText` matched two nodes per block.
						     max-sm:sr-only keeps it announced on a phone, where the blocks are
						     too narrow to print it. -->
						<span
							class="max-sm:sr-only px-1 text-center text-[0.7rem] font-medium tracking-wider uppercase"
						>
							{place_label(p.place)}
						</span>
					</div>
				</div>
			{/each}
		</div>

		{#snippet row(p: { name: string; score: number; place: number })}
			<li class="flex items-center gap-3 px-4 py-2">
				<span class="w-6 text-sm font-semibold text-muted-foreground tabular-nums"
					>{p.place}</span
				>
				<FrogAvatar name={p.name} class="size-8" />
				<span class="min-w-0 flex-1 truncate font-medium" title={p.name}>{p.name}</span>
				<span class="text-sm text-muted-foreground tabular-nums">{p.score}</span>
			</li>
		{/snippet}

		{#if runners_up.length}
			<div
				class="w-full max-w-md"
				in:fade|global={{ duration: dur(DUR.surface), delay: reduced() ? 0 : winner_lands + 900 }}
			>
				<Collapsible.Root bind:open={show_all} class="flex flex-col items-center gap-3">
					<div class="w-full overflow-hidden rounded-xl border border-border bg-card">
						<ul class="divide-y divide-border">
							{#each runners_up as p (p.name)}
								{@render row(p)}
							{/each}
						</ul>
						<!-- A second list rather than the Content inside the first: Content
						     renders a div, and a div is not allowed as a child of a ul. -->
						{#if the_rest.length}
							<Collapsible.Content>
								<ul class="divide-y divide-border border-t border-border">
									{#each the_rest as p (p.name)}
										{@render row(p)}
									{/each}
								</ul>
							</Collapsible.Content>
						{/if}
					</div>
					{#if the_rest.length}
						<Collapsible.Trigger class={buttonVariants({ variant: 'outline', size: 'sm' })}>
							{show_all
								? $t('admin_page.show_fewer_players')
								: $t('admin_page.show_all_players', { count: ranked.length })}
							<ChevronDown
								class="transition-transform {show_all ? 'rotate-180' : ''}"
								aria-hidden="true"
							/>
						</Collapsible.Trigger>
					{/if}
				</Collapsible.Root>
			</div>
		{/if}
		<!-- Room under the last row for the fixed score pill on a player's phone, or the
		     expanded list ends underneath it. -->
		{#if username && username in data}
			<div class="h-16 shrink-0" aria-hidden="true"></div>
		{/if}
	</div>

	<!-- Not `data[username]`: a player on 0 points is falsy, and lost this line. -->
	{#if username && username in data}
		{@const me = ranked.find((p) => p.name === username)}
		{@const medal = me && me.place <= 3 ? MEDALS[me.place] : null}
		<div class="fixed bottom-0 left-0 mb-6 flex w-full justify-center px-4">
			<div
				class="border-border bg-card/90 flex items-center gap-3 rounded-full border py-1.5 pr-5 pl-1.5 shadow-lg backdrop-blur"
			>
				<FrogAvatar name={username} class="size-9" />
				<!-- A player who placed gets the medal on their own phone, which is the only
				     thing they take away from the room. Kahoot does the same, and it is the
				     difference between "you finished" and "you placed". -->
				{#if medal}
					<span
						class="flex shrink-0 items-center gap-1.5 font-semibold whitespace-nowrap {medal.ink}"
					>
						<Medal class="size-5" aria-hidden="true" />
						{$t(medal.key)}
					</span>
					<span class="bg-border h-4 w-px" aria-hidden="true"></span>
				{/if}
				<p class="text-sm font-medium whitespace-nowrap tabular-nums">
					{$t('play_page.your_score', { score: data[username] })}
				</p>
				<!-- The medal already says the place; repeating it as "You're on place 1!"
				     beside it is the same fact twice on a 390px pill. -->
				{#if me && !medal}
					<span class="bg-border h-4 w-px" aria-hidden="true"></span>
					<p class="text-muted-foreground text-sm whitespace-nowrap tabular-nums">
						{$t('play_page.your_place', { place: me.place })}
					</p>
				{/if}
			</div>
		</div>
	{/if}
{/if}

<style>
	/* The medal on a player's own score pill, which is bg-card: white in light, zinc-900
	   in dark. */
	.medal-ink-1 {
		color: #8a6500;
	}
	.medal-ink-2 {
		color: #71717a;
	}
	.medal-ink-3 {
		color: #a8622f;
	}
	:global(html.dark) .medal-ink-1 {
		color: #b8860b;
	}
	:global(html.dark) .medal-ink-2 {
		color: #a1a1aa;
	}
	:global(html.dark) .medal-ink-3 {
		color: #c98450;
	}

	/* The podium had gold, silver and bronze gradients with a white inset highlight, which
	   is a lot of color for a screen whose job is to say who won -- and it put a third
	   accent in an identity that is "zinc neutrals plus one loud element" (CLAUDE.md).
	   One loud block instead: the winner is flat gold, second and third are the page's own
	   surfaces, and the rank is carried by height, numeral and label rather than by three
	   competing hues. */
	.podium-block {
		background: var(--muted);
		color: var(--foreground);
	}

	.podium-block.is-silver {
		background: var(--muted);
	}

	/* Third sits back a step: same surface, quieter ink. */
	.podium-block.is-bronze {
		background: var(--muted);
		color: var(--muted-foreground);
	}

	/* The one loud thing on the screen. Flat, not a gradient: a gradient on a block this
	   size reads as plastic from the back of a room. Ink is #1b1b1f on #f5c33c, 10.4:1. */
	.podium-block.is-gold {
		background: #f5c33c;
		border-color: #dba81f;
		color: #1b1b1f;
	}

	.podium-block.is-winner {
		box-shadow: 0 -12px 44px -16px rgb(245 195 60 / 0.9);
	}

	.podium-block :global(span) {
		color: inherit;
	}

	.crown {
		animation: crown-pop var(--fq-dur-stage) var(--fq-ease-spring) both;
	}

	@keyframes crown-pop {
		from {
			transform: scale(0.4) translateY(8px);
		}
		to {
			transform: scale(1) translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.crown {
			animation: none;
		}
	}
</style>
