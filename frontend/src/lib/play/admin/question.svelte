<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { in_last_seconds } from '$lib/play/last_seconds';
	import { QuizQuestionType } from '$lib/quiz_types';
	import type { QuizData, RangeQuizAnswer } from '$lib/quiz_types';
	import { get_foreground_color } from '$lib/helpers.js';
	import AnswerShape from '$lib/play/kahoot_mode_assets/AnswerShape.svelte';
	import MediaComponent from '$lib/editor/MediaComponent.svelte';
	import { getLocalization } from '$lib/i18n';
	import { sanitizeTitleHtml } from '$lib/sanitize';
	import TickLoop from '$lib/play/admin/tick_loop.svelte';

	interface Props {
		quiz_data: QuizData;
		selected_question: number;
		timer_res: string;
		answer_count: number;
		/** Players in the game, for "2 of 3 answered". */
		player_count: number;
		default_colors: readonly string[];
	}

	let {
		quiz_data,
		selected_question,
		timer_res = $bindable(),
		answer_count,
		player_count,
		default_colors
	}: Props = $props();
	const answers = $derived(
		quiz_data.questions[selected_question].answers as { answer: string; right?: boolean }[]
	);

	// The palette by slot, wrapping: a question can have ten answers and the palette has
	// four, so indexing the array directly left answers five to ten with no color. A color
	// stored on the answer is not consulted -- see answer_colors.ts.
	const tile_color = (i: number) => default_colors[i % default_colors.length];

	const { t } = getLocalization();

	const question_seconds = $derived(parseInt(quiz_data.questions[selected_question].time));
</script>

<!-- The stage wrapper is what the other three host screens (lobby, per-question
     results, podium) already use. This one was left without it, so its content sat
     flush against the top of the viewport: the title was overlapped by the fixed
     controls bar and the timer rule, and the bottom half of the projector was
     empty. -->
<!-- Host screen only: the tick loop speeds up as the time runs out, and stops at zero. -->
<TickLoop remaining={parseInt(timer_res)} total={question_seconds} />

<div class="fq-stage">
	<div class="fq-section">
		<!-- wrap-anywhere so one long word cannot push the layout sideways: a 272-character title with no spaces in it overflowed by thousands of pixels on 2026-10-02. QuizInput caps the length now, but quizzes saved before that are not revalidated. -->
		<h1 class="fq-display max-w-[22ch] text-center font-bold text-balance wrap-anywhere">
			{@html sanitizeTitleHtml(quiz_data.questions[selected_question].question)}
		</h1>
		<!-- With shapes only on the phones, this screen is the one place that can say a
		     question takes more than one answer. Nothing did. -->
		{#if quiz_data.questions[selected_question].type === QuizQuestionType.CHECK}
			<p class="fq-meta text-muted-foreground -mt-2 text-center font-medium">
				{$t('play_page.pick_every_correct')}
			</p>
		{/if}
	</div>
	{#if quiz_data.questions[selected_question].image !== null}
		<div class="flex w-full justify-center">
			<MediaComponent
				src={quiz_data.questions[selected_question].image}
				muted={false}
				css_classes="max-h-[30vh] w-auto rounded-xl object-cover"
			/>
		</div>
	{/if}
	<!-- The time and the count, as one bar above the answers that empties as time runs
	     out (François, 11 Oct, option C of four). They used to sit in one small row squeezed
	     between the title and the answers, beside a thin rule under the controls bar that
	     this replaces. -->
	<div
		class="grid w-full max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-[var(--fq-space-group)]"
	>
		<p class="fq-meta text-muted-foreground font-medium tabular-nums" aria-live="polite">
			<b class="text-foreground font-bold">{answer_count}</b>
			{$t('admin_page.answered_of', { total: player_count })}
		</p>
		<div
			class="bg-muted h-[clamp(0.5rem,0.8vw,0.9rem)] overflow-hidden rounded-full"
			role="progressbar"
			aria-label={$t('admin_page.time_remaining')}
			aria-valuemin={0}
			aria-valuemax={question_seconds}
			aria-valuenow={parseInt(timer_res)}
		>
			<!-- scaleX, not width: a transform is composited, while width lays the page out
			     again on every frame (lib/a11y/motion.test.ts). -->
			<div
				class="h-full w-full origin-left rounded-full motion-safe:transition-transform motion-safe:duration-1000 motion-safe:ease-linear {in_last_seconds(
					timer_res
				)
					? 'bg-destructive'
					: 'bg-foreground'}"
				style:transform="scaleX({question_seconds > 0
					? Math.max(0, Math.min(1, parseInt(timer_res) / question_seconds))
					: 0})"
			></div>
		</div>
		<span
			class="min-w-[2ch] text-right text-[clamp(2rem,3.4vw,4rem)] leading-none font-extrabold tracking-tight tabular-nums"
			aria-hidden="true">{timer_res}</span
		>
	</div>
	{#if quiz_data.questions[selected_question].type === QuizQuestionType.ABCD || quiz_data.questions[selected_question].type === QuizQuestionType.VOTING || quiz_data.questions[selected_question].type === QuizQuestionType.CHECK}
		<div
			class="mx-auto grid w-full max-w-6xl grid-cols-1 gap-[var(--fq-space-item)] sm:grid-cols-2"
		>
			{#each answers as answer, i}
				<div
					class="answer-row relative flex min-h-20 items-center overflow-hidden rounded-2xl transition-all duration-300
					motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
					style="background-color: {tile_color(i)}; animation-delay: {i * 70}ms"
					class:opacity-50={!answer.right &&
						timer_res === '0' &&
						quiz_data.questions[selected_question].type === QuizQuestionType.ABCD}
				>
					<AnswerShape
						index={i}
						class="w-7 h-7 ml-4 shrink-0 self-center"
						style="color: {get_foreground_color(tile_color(i))}"
					/>
					<span
						class="fq-answer w-full px-3 py-5 text-center font-semibold wrap-anywhere"
						style="color: {get_foreground_color(tile_color(i))}">{answer.answer}</span
					>
					<span class="pl-4 w-10"></span>
				</div>
			{/each}
		</div>
	{:else if quiz_data.questions[selected_question].type === QuizQuestionType.TEXT}
		<!-- The accepted answers are not listed: they are the solution, and they went up
		     the moment time ran out, before the results (#93). -->
		<p class="fq-answer text-muted-foreground text-center">
			{$t('admin_page.players_type_answer')}
		</p>
	{:else if quiz_data.questions[selected_question].type === QuizQuestionType.RANGE}
		<!-- The scale only, never the right range (#93): there was no branch, so a slider
		     question showed the title over nothing. -->
		<p class="fq-answer text-muted-foreground text-center tabular-nums">
			{$t('admin_page.players_pick_number', {
				min: (
					quiz_data.questions[selected_question].answers as RangeQuizAnswer
				).min.toLocaleString(),
				max: (
					quiz_data.questions[selected_question].answers as RangeQuizAnswer
				).max.toLocaleString()
			})}
		</p>
	{/if}
</div>
