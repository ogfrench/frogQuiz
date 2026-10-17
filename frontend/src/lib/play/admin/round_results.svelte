<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors
SPDX-License-Identifier: MPL-2.0
-->
<script lang="ts">
	import { flip } from 'svelte/animate';
	import { fly, slide } from 'svelte/transition';
	import { onMount } from 'svelte';
	import { getLocalization } from '$lib/i18n';
	import { DUR, dur, reduced, stagger } from '$lib/motion';
	import { sfx, stopSfx } from '$lib/play/sfx';
	import TextResults from '$lib/play/admin/text_results.svelte';
	import VotingResults from './voting_results.svelte';
	import type { Question } from '$lib/quiz_types';
	import { QuizQuestionType } from '$lib/quiz_types';
	import { sanitizeTitleHtml } from '$lib/sanitize';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Minus from '@lucide/svelte/icons/minus';
	import FrogAvatar from '$lib/components/FrogAvatar.svelte';

	const { t } = getLocalization();

	interface Props {
		question: Question;
		/** This question's results: the split of answers, and the points each player just gained. */
		new_data: Array<{
			username: string;
			answer: string;
			right: boolean;
			time_taken: number;
			score: number;
		}>;
		/** Running totals, already including this question. */
		totals: Record<string, number>;
		/** Whether the standings have grown under the answers (next_step.ts: standingsShown). */
		show_standings: boolean;
	}

	// One card for the whole stretch between a question and the next. It opens on the answers
	// and, when the standings are due, shrinks them and grows the standings under them. It
	// used to be two components, swapped, the second loaded on the spot: the room watched one
	// screen vanish for another, with a spinner in the gap.
	let { question, new_data, totals, show_standings }: Props = $props();

	const gained = $derived(
		Object.fromEntries((new_data ?? []).map((r) => [r.username, r.score ?? 0]))
	);
	// Where each player stood before this question's points landed. Movement is the thing a
	// scoreboard is for: a number that only goes up says nothing about the race.
	// Equal scores share a place (1, 1, 3), as on any leaderboard: two players on 0 were
	// "2nd" and "3rd" by join order.
	const order = (score: (name: string) => number) => {
		const ranked = Object.keys(totals ?? {})
			.map((name) => ({ name, value: score(name) }))
			.sort((a, b) => b.value - a.value);
		return ranked.map((p) => ({
			name: p.name,
			score: Number(totals[p.name]) || 0,
			place: ranked.findIndex((q) => q.value === p.value) + 1
		}));
	};
	const before = $derived(order((n) => (Number(totals[n]) || 0) - (gained[n] ?? 0)));
	const after = $derived(order((n) => Number(totals[n]) || 0));
	const place_before = $derived(Object.fromEntries(before.map((p) => [p.name, p.place])));
	// Before the first points everyone is level, so there is no order to move from: the
	// arrows were invented ("up" at 899 against 0) from join order.
	const no_order_before = $derived(before.every((p) => p.place === 1));

	// The standings appear in last question's order and then move: the rows slide to their
	// new places a beat later, which is the part worth watching. With reduced motion they
	// are in their new places at once.
	let settled = $state(reduced());
	$effect(() => {
		if (!show_standings) {
			settled = reduced();
			return;
		}
		sfx('scoreboard');
		const timer = setTimeout(() => (settled = true), reduced() ? 0 : 700);
		return () => clearTimeout(timer);
	});
	// Kahoot shows five. More than that stops being readable across a room, and the rest of
	// the field is on the spreadsheet and on each player's own screen.
	const top = $derived((settled ? after : before).slice(0, 5));
	const rest = $derived(after.length - top.length);

	onMount(() => {
		sfx('reveal');
		// Leaving the card (the next question) ends its sounds.
		return stopSfx;
	});

	const has_answers = $derived(
		[
			QuizQuestionType.ABCD,
			QuizQuestionType.CHECK,
			QuizQuestionType.VOTING,
			QuizQuestionType.TEXT
		].includes(question.type)
	);
</script>

<div class="fq-stage">
	<!-- A fixed light "paper" surface rather than the bg-card token: it sits on the quiz
	     author's own background colour, not the app's theme, so in dark mode bg-card made
	     it near-black with equally dark text, unreadable on whatever the game background
	     happened to be (D34 keeps it white). -->
	<div
		data-testid="round-card"
		data-standings={String(show_standings)}
		class="w-full max-w-2xl overflow-hidden rounded-2xl border border-neutral-200 bg-white text-neutral-900 shadow-sm lg:max-w-4xl"
	>
		{#if has_answers}
			<!-- CHECK was missing here once, so after a multiple-answer question the projector
			     showed an empty card. `zoom` is what shrinks the answers when the standings
			     arrive: one number to animate, and everything inside scales with it. -->
			<section
				data-testid="round-answers"
				class="flex flex-col gap-[var(--fq-space-group)] p-6 transition-[zoom] duration-500 ease-out motion-reduce:transition-none sm:p-8"
				style:zoom={show_standings ? 0.72 : 1}
			>
				<h1
					class="text-center text-lg font-semibold tracking-tight text-balance wrap-anywhere lg:text-3xl"
				>
					{@html sanitizeTitleHtml(question.question)}
				</h1>
				{#if question.type === QuizQuestionType.TEXT}
					<TextResults data={new_data} {question} />
				{:else}
					<VotingResults data={new_data} {question} />
				{/if}
			</section>
		{/if}
		{#if show_standings}
			<section data-testid="standings" in:slide|global={{ duration: dur(DUR.stage) }}>
				<h2
					class="border-y border-neutral-200 bg-neutral-100 px-6 py-3 text-center text-sm font-semibold tracking-wider uppercase lg:text-base"
				>
					{$t('admin_page.scoreboard')}
				</h2>
				<ul class="divide-y divide-neutral-200">
					{#each top as player (player.name)}
						{@const moved = no_order_before
							? 0
							: (place_before[player.name] ?? player.place) - player.place}
						<li
							class="flex items-center gap-4 px-6 py-3 lg:gap-6 lg:py-4"
							animate:flip={{ duration: dur(DUR.stage) }}
						>
							<span class="w-8 text-xl font-bold tabular-nums lg:w-12 lg:text-3xl">
								{player.place}
							</span>
							<!-- Big enough to be found from the back of the room: a player spots
							     their frog before they have read the name. -->
							<FrogAvatar
								name={player.name}
								class="size-11 bg-neutral-100 text-neutral-500 lg:size-16"
							/>
							<span class="min-w-0 flex-1 truncate text-lg font-medium lg:text-3xl">
								{player.name}
							</span>
							<!-- Up, down or held. Shape as well as direction, so it does not rest on a
							     colour nobody can see from four metres away. -->
							<span
								class="flex w-10 shrink-0 items-center justify-center text-neutral-500"
							>
								{#if settled && moved > 0}
									<ChevronUp class="size-5 lg:size-7" aria-hidden="true" />
								{:else if settled && moved < 0}
									<ChevronDown class="size-5 lg:size-7" aria-hidden="true" />
								{:else}
									<Minus class="size-4 lg:size-5" aria-hidden="true" />
								{/if}
								<span class="sr-only">
									{moved > 0
										? $t('admin_page.moved_up', { count: moved })
										: moved < 0
											? $t('admin_page.moved_down', { count: -moved })
											: $t('admin_page.held_place')}
								</span>
							</span>
							<span
								class="w-20 text-right text-lg font-semibold tabular-nums lg:w-28 lg:text-3xl"
							>
								{player.score}
							</span>
							<span
								class="w-16 text-right text-sm tabular-nums lg:w-24 lg:text-xl"
								class:text-neutral-500={!gained[player.name]}
								in:fly|global={{
									x: 40,
									duration: dur(DUR.surface),
									delay: stagger(player.place, 60)
								}}
							>
								+{gained[player.name] ?? 0}
							</span>
						</li>
					{/each}
				</ul>
				{#if rest > 0}
					<p
						class="border-t border-neutral-200 px-6 py-2.5 text-center text-sm text-neutral-500"
					>
						{$t('admin_page.and_more_players', { count: rest })}
					</p>
				{/if}
			</section>
		{/if}
	</div>
</div>
