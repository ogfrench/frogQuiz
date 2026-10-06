<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import type { Question } from '$lib/quiz_types';
	import { answerColor } from '$lib/play/answer_colors';
	import { get_foreground_color } from '$lib/helpers';
	import AnswerShape from '$lib/play/kahoot_mode_assets/AnswerShape.svelte';
	import CircularTimer from '$lib/play/circular_progress.svelte';
	import Check from '@lucide/svelte/icons/check';

	interface Props {
		question: Question;
		selected_answer?: string;
		game_mode: any;
		timer_res: any;
		circular_progress: any;
	}

	let {
		question,
		selected_answer = $bindable(),
		game_mode,
		timer_res,
		circular_progress
	}: Props = $props();
	const answers = $derived(question.answers as { answer: string }[]);
	// Sized to the question rather than hardcoded to four, so a question with a
	// different number of options still tracks every tile.
	let _selected_answers = $state((question.answers as { answer: string }[]).map(() => false));

	// The wire format is the indices of everything ticked, concatenated in
	// ascending order: ticking the first and third option sends "02". The backend
	// builds the same string from the options marked right and compares the two,
	// so scoring is all or nothing -- a partly correct set scores zero. That only
	// stays unambiguous while there are fewer than ten options, which the editor
	// enforces by capping a question at four.
	const selectAnswer = (i: number) => {
		_selected_answers[i] = !_selected_answers[i];
		const picked = _selected_answers
			.map((chosen, index) => (chosen ? String(index) : ''))
			.join('');
		// Undefined rather than '' when nothing is ticked, so the submit button stays
		// disabled. Unticking everything used to leave an empty string behind, which
		// is a value, so the player could submit a blank answer.
		selected_answer = picked === '' ? undefined : picked;
	};
</script>

<div class="relative min-h-0 w-full flex-1">
	<div
		class="absolute top-0 bottom-0 left-0 right-0 m-auto rounded-full h-fit w-fit border-2 border-black shadow-2xl z-40"
	>
		<CircularTimer text={timer_res} progress={circular_progress} color="#ef4444" />
	</div>

	<div
		class="grid grid-rows-2 grid-flow-col auto-cols-[minmax(0,1fr)] gap-3 w-full p-4 h-full"
		class:has-picks={_selected_answers.some(Boolean)}
	>
		{#each answers as answer, i}
			{@const picked = _selected_answers[i]}
			<!-- Focus is a foreground outline. It was ring-white/80, a white ring on a near-white
			     page, so tabbing between answers showed nothing in light mode. -->
			<button
				type="button"
				class="answer-tile group relative overflow-hidden rounded-2xl h-full
					flex items-center justify-center
					transition-[transform,opacity,filter] duration-200 ease-out
					motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95
					focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-foreground
					active:scale-[0.96] hover:scale-[1.02]"
				class:is-picked={picked}
				style="background-color: {answerColor(i)}; color: {get_foreground_color(
					answerColor(i)
				)}; animation-delay: {i * 70}ms"
				aria-label={answer.answer}
				aria-pressed={picked}
				onclick={() => selectAnswer(i)}
			>
				<!-- Gloss and floor shading, matching the single-answer tiles. Decorative. -->
				<span
					aria-hidden="true"
					class="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-black/15"
				></span>
				{#if game_mode === 'kahoot'}
					<AnswerShape
						index={i}
						class="relative h-1/2 max-h-24 w-auto drop-shadow-sm transition-transform duration-200 group-active:scale-90"
					/>
				{:else}
					<p
						class="relative m-auto text-lg font-semibold px-3 text-balance wrap-anywhere"
					>
						{answer.answer}
					</p>
				{/if}
				<!-- Unlike a single-answer question, a tick here is a state you can undo, so
				     it needs to stay legible for the whole round rather than just flash. -->
				{#if picked}
					<span
						aria-hidden="true"
						class="absolute inset-0 ring-4 ring-inset ring-white rounded-2xl motion-safe:animate-in motion-safe:zoom-in-95"
					></span>
					<!-- The ring alone was faint on a pastel tile in light mode; a tick says
					     "chosen" without relying on how bright the tile is. -->
					<span
						aria-hidden="true"
						class="absolute top-3 right-3 grid size-8 place-items-center rounded-full bg-white text-black shadow-md motion-safe:animate-in motion-safe:zoom-in-50"
					>
						<Check class="size-5" strokeWidth={3} />
					</span>
				{/if}
			</button>
		{/each}
	</div>
</div>

<style>
	/* Ticked tiles lift; unticked ones recede, so a glance shows the current set. Only
	   once something is ticked: applied from the start, it opened every multiple-answer
	   question with all four tiles faded, looking disabled. */
	.has-picks .answer-tile:not(.is-picked) {
		opacity: 0.5;
		filter: saturate(0.6);
		transform: scale(0.97);
	}

	.answer-tile.is-picked {
		transform: scale(1.03);
	}
</style>
