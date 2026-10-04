<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import type { Answer, Question, VotingAnswer } from '$lib/quiz_types';
	import { QuizQuestionType } from '$lib/quiz_types';
	import AnswerShape from '$lib/play/kahoot_mode_assets/AnswerShape.svelte';
	import { answerColor } from '$lib/play/answer_colors';
	import Check from '@lucide/svelte/icons/check';
	import { getLocalization } from '$lib/i18n';

	const { t } = getLocalization();

	interface Props {
		data: any;
		question: Question;
	}

	let { data, question }: Props = $props();

	// Horizontal bars, because answer text is long and the previous vertical
	// layout had to rotate its labels 45 degrees, where they collided with each
	// other. Color matches the tile the player tapped, and the shape repeats it
	// so identity never rests on color alone.
	// Question.answers is a union covering every question type, including a range
	// object and a slide string. This component is only rendered for the choice
	// types, so narrow once here rather than casting at each use.
	const answers = question.answers as (Answer | VotingAnswer)[];

	const is_voting = question.type === QuizQuestionType.VOTING;
	const is_check = question.type === QuizQuestionType.CHECK;

	// A CHECK player submits the indices of everything they ticked, concatenated:
	// ticking the first and third option sends "02". Matching that against the
	// answer text, as the other types do, never matches, so every bar on a CHECK
	// question read zero. Count a submission once for each option it contains.
	const counts = is_check
		? answers.map(
				(_, i) =>
					data.filter((d: { answer: string }) => (d.answer ?? '').includes(String(i)))
						.length
			)
		: answers.map((a) => data.filter((d: { answer: string }) => d.answer === a.answer).length);

	// On CHECK the counts overlap, so summing them would over-report. The number
	// that means something to the room is how many people answered at all.
	const total = is_check ? data.length : counts.reduce((sum, n) => sum + n, 0);
	const max = Math.max(1, ...counts);
	const isCorrect = (a: Answer | VotingAnswer) => !is_voting && (a as Answer).right === true;
</script>

<!-- This renders inside results.svelte's own fq-stage + card, not as its own host
     screen -- an fq-stage here nested a second min-height:100dvh block inside the
     results card, which is what stretched that card far taller than its content. -->
<div class="mx-auto w-full max-w-3xl px-6 lg:max-w-4xl">
	<ul class="flex flex-col gap-2.5">
		{#each answers as answer, i}
			{@const count = counts[i]}
			{@const correct = isCorrect(answer)}
			<li
				class="flex items-center gap-3 transition-opacity duration-300"
				class:opacity-70={!correct && !is_voting}
			>
				<span class="flex w-40 shrink-0 items-center gap-2 sm:w-56 lg:w-72">
					<AnswerShape index={i} class="size-4 shrink-0 text-neutral-500 lg:size-6" />
					<span class="truncate text-base font-medium lg:text-2xl" title={answer.answer}>
						{answer.answer}
					</span>
					{#if correct}
						<Check
							class="size-4 shrink-0 text-neutral-900 lg:size-6"
							strokeWidth={3}
							aria-hidden="true"
						/>
						<span class="sr-only">{$t('words.correct')}</span>
					{/if}
				</span>

				<span
					class="relative h-8 flex-1 overflow-hidden rounded-md bg-neutral-100 lg:h-11"
					class:ring-2={correct}
					class:ring-neutral-900={correct}
				>
					<span
						class="absolute inset-y-0 left-0 w-full origin-left rounded-r-md transition-transform ease-out"
						style="transform: scaleX({count / max}); transition-duration: var(--fq-dur-reveal); background-color: {answerColor(i)}"
					></span>
				</span>

				<span class="w-14 shrink-0 text-right text-base font-semibold tabular-nums lg:text-2xl">
					{count}
					<span class="sr-only">
						{$t('admin_page.chose_this', { count })}
					</span>
				</span>
			</li>
		{/each}
	</ul>

	<p class="mt-4 text-center text-sm text-neutral-500 tabular-nums lg:text-lg">
		{$t('admin_page.answers_submitted', { count: total })}
	</p>
</div>
