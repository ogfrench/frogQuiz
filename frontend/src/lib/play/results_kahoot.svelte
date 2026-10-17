<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { getLocalization } from '$lib/i18n';
	import { scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { DUR, dur } from '$lib/motion';
	import { sfx } from '$lib/play/sfx';
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import Minus from '@lucide/svelte/icons/minus';
	import Vote from '@lucide/svelte/icons/vote';

	const { t } = getLocalization();

	function sortObjectbyValue(obj) {
		const ret = {};
		Object.keys(obj)
			.sort((a, b) => obj[b] - obj[a])
			.forEach((s) => (ret[s] = obj[s]));
		return ret;
	}

	interface Props {
		scores: any;
		question_results: Array<{
			username: string;
			answer: string;
			right: boolean;
			time_taken: number;
			score: number;
		}>;
		username: any;
		// Given only when the phones show the answers' text (game_mode 'normal'): with the
		// answers on the projector alone, the text would be new on the phone.
		correct_answers?: string[];
		/** A poll: a vote is counted, never right or wrong (#93). */
		poll?: boolean;
	}

	let {
		scores = $bindable(),
		question_results,
		username,
		correct_answers,
		poll = false
	}: Props = $props();
	let score_by_username = $state({});

	if (JSON.stringify(scores) === '{}') {
		for (const i of question_results) {
			scores[i.username] = 0;
		}
	}
	for (const i of question_results) {
		score_by_username[i.username] = i.score;
	}
	for (const username of Object.keys(score_by_username)) {
		scores[username] = (score_by_username[username] ?? 0) + (scores[username] ?? 0);
	}
	scores = scores;
	let sorted_scores = $derived(sortObjectbyValue(scores));

	// The screen said "+760" and nothing else, so a player never learned whether they had
	// been right -- and "+0" with no explanation reads as a bug rather than a wrong answer.
	// Everything needed is already in question_results; nothing new crosses the socket.
	const my_result = $derived(question_results.find((r) => r.username === username));
	const answered = $derived(my_result !== undefined);
	const right = $derived(my_result?.right === true);
	// What the right answer was, for a player who missed it (François, 17 Oct).
	const show_correct = $derived(!right && (correct_answers?.length ?? 0) > 0);

	// One sound for the result, as it appears: right, wrong, or nothing for a player who did
	// not answer (they already know).
	// A poll has no wrong answer, so no wrong sound: a vote used to be told "Not this time".
	$effect(() => {
		if (answered && !poll) sfx(right ? 'correct' : 'incorrect');
	});
	// Equal scores share a place, as on the host's scoreboard (1, 1, 3).
	const place = $derived.by(() => {
		const values = Object.values(sorted_scores).map((s) => Number(s) || 0);
		const mine = Number(sorted_scores[username]) || 0;
		return username in sorted_scores ? values.findIndex((v) => v === mine) + 1 : 0;
	});
	// "1st", not "1": the rank is the one thing a player glances down for.
	const ORDINAL: Record<string, string> = { one: 'st', two: 'nd', few: 'rd', other: 'th' };
	const ordinal_rules = new Intl.PluralRules('en', { type: 'ordinal' });
	const ordinal = (n: number) => `${n}${ORDINAL[ordinal_rules.select(n)]}`;
	const players = $derived(Object.keys(sorted_scores).length);
</script>

<!-- This laid itself out with `h-screen` + `m-auto`, which did two wrong things at
     once: 100vh is the wrong number on a phone, and a second full-height centering
     block inside the route's stage is what left the card visually off-center with a
     dead half-screen under it. The card now only draws itself and lets the stage
     place it.
     Fixed light "paper" rather than the bg-card token, for the same reason the host
     results card is: it sits on the quiz author's own background color, not the
     app theme, so in dark mode bg-card made it near-black on near-black. -->
<!-- A status, so the result is announced when it lands: the card replaces the question
     with no focus move, and a screen reader said nothing (V1 game-screen review). -->
<div
	role="status"
	class="mx-auto flex w-full max-w-xs flex-col items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-6 py-7 sm:px-8 text-center text-neutral-900 shadow-sm"
>
	<!-- Shape as well as color: about one man in twelve cannot tell the green from the
	     red, and this is the one moment of the game that has to land. -->
	<div
		in:scale|global={{ duration: dur(DUR.surface), start: 0.6, easing: backOut }}
		class="flex size-14 items-center justify-center rounded-full {answered
			? poll
				? 'bg-neutral-100 text-neutral-700'
				: right
					? 'bg-emerald-100 text-emerald-700'
					: 'bg-rose-100 text-rose-700'
			: 'bg-neutral-100 text-neutral-500'}"
	>
		{#if poll && answered}
			<Vote class="size-7" aria-hidden="true" />
		{:else if !answered}
			<Minus class="size-7" aria-hidden="true" />
		{:else if right}
			<Check class="size-7" aria-hidden="true" />
		{:else}
			<X class="size-7" aria-hidden="true" />
		{/if}
	</div>

	<p
		class="text-2xl font-bold {answered
			? poll
				? 'text-neutral-900'
				: right
					? 'text-emerald-700'
					: 'text-rose-700'
			: 'text-neutral-500'}"
	>
		{#if poll}
			{answered ? $t('play_page.vote_counted') : $t('play_page.no_vote')}
		{:else if !answered}
			{$t('play_page.answer_none')}
		{:else if right}
			{$t('play_page.answer_correct')}
		{:else}
			{$t('play_page.answer_wrong')}
		{/if}
	</p>

	{#if show_correct && correct_answers}
		<div class="w-full rounded-xl bg-emerald-50 px-4 py-3 text-left text-emerald-950">
			<p class="text-xs font-semibold tracking-wide text-emerald-800 uppercase">
				{$t('play_page.correct_answer', { count: correct_answers.length })}
			</p>
			<ul class="mt-1.5 flex flex-col gap-1.5">
				{#each correct_answers as answer, i (i)}
					<li
						class="flex gap-2 leading-snug font-medium {correct_answers.length > 1
							? 'text-sm'
							: 'text-base'}"
					>
						<Check
							class="mt-[0.15em] size-4 shrink-0 text-emerald-700"
							aria-hidden="true"
						/>
						<span class="min-w-0 wrap-anywhere">{answer}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- A poll scores nothing for anyone, so "+0" would only read as a penalty. -->
	{#if !poll}
		<p class="text-4xl font-bold tabular-nums">
			+{score_by_username[username] ?? '0'}
		</p>
	{/if}

	<div class="flex flex-col gap-1">
		{#if place > 0 && players > 1 && !poll}
			<p class="text-base font-semibold tabular-nums">
				{$t('play_page.place_of', { place: ordinal(place), total: players })}
			</p>
		{/if}
		<p class="text-sm text-neutral-500 tabular-nums">
			{$t('play_page.total_score', { score: sorted_scores[username] ?? 0 })}
		</p>
	</div>
</div>
