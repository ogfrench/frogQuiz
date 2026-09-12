<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 FrogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import type { Answer, Question, VotingAnswer } from '$lib/quiz_types';
	import { QuizQuestionType } from '$lib/quiz_types';
	import AnswerShape from '$lib/play/kahoot_mode_assets/AnswerShape.svelte';
	import { answerColor } from '$lib/play/answer_colors';
	import { getLocalization } from '$lib/i18n';

	const { t } = getLocalization();

	interface Props {
		data: any;
		question: Question;
	}

	let { data, question }: Props = $props();

	// Horizontal bars, because answer text is long and the previous vertical
	// layout had to rotate its labels 45 degrees, where they collided with each
	// other. Colour matches the tile the player tapped, and the shape repeats it
	// so identity never rests on colour alone.
	// Question.answers is a union covering every question type, including a range
	// object and a slide string. This component is only rendered for the choice
	// types, so narrow once here rather than casting at each use.
	const answers = question.answers as (Answer | VotingAnswer)[];

	const counts = answers.map(
		(a) => data.filter((d: { answer: string }) => d.answer === a.answer).length
	);
	const total = counts.reduce((sum, n) => sum + n, 0);
	const max = Math.max(1, ...counts);
	const is_voting = question.type === QuizQuestionType.VOTING;
	const isCorrect = (a: Answer | VotingAnswer) => !is_voting && (a as Answer).right === true;
</script>

<div class="mx-auto w-full max-w-3xl px-6">
	<ul class="flex flex-col gap-2.5">
		{#each answers as answer, i}
			{@const count = counts[i]}
			{@const correct = isCorrect(answer)}
			<li
				class="flex items-center gap-3 transition-opacity duration-300"
				class:opacity-70={!correct && !is_voting}
			>
				<span class="flex w-40 shrink-0 items-center gap-2 sm:w-56">
					<AnswerShape index={i} class="size-4 shrink-0 text-muted-foreground" />
					<span class="truncate text-base font-medium" title={answer.answer}>
						{@html answer.answer}
					</span>
					{#if correct}
						<svg
							class="size-4 shrink-0 text-foreground"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="3"
							role="img"
							aria-label={$t('words.correct')}
						>
							<path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					{/if}
				</span>

				<span
					class="relative h-8 flex-1 overflow-hidden rounded-md bg-muted"
					class:ring-2={correct}
					class:ring-foreground={correct}
				>
					<span
						class="absolute inset-y-0 left-0 rounded-r-md transition-[width] duration-700 ease-out"
						style="width: {(count / max) * 100}%; background-color: {answer.color ?? answerColor(i)}"
					></span>
				</span>

				<span class="w-14 shrink-0 text-right text-base font-semibold tabular-nums">
					{count}
					<span class="sr-only">
						{$t('play_page.players_waiting_plural', { count })}
					</span>
				</span>
			</li>
		{/each}
	</ul>

	<p class="mt-4 text-center text-sm text-muted-foreground tabular-nums">
		{$t('admin_page.answers_submitted', { answer_count: total })}
	</p>
</div>
