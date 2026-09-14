<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { ANSWER_COLORS } from '$lib/play/answer_colors';
	import AnswerShape from '$lib/play/kahoot_mode_assets/AnswerShape.svelte';

	import type { Answer, EditorData } from '../quiz_types';
	import { QuizQuestionType } from '../quiz_types';
	import { fade } from 'svelte/transition';
	import { getLocalization } from '$lib/i18n';
	import { get_foreground_color } from '$lib/helpers';
	import Check from '@lucide/svelte/icons/check';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';

	const { t } = getLocalization();

	interface Props {
		selected_question: number;
		check_choice?: boolean;
		data: EditorData;
	}

	let { selected_question, check_choice = false, data = $bindable() }: Props = $props();
	if (!Array.isArray(data.questions[selected_question].answers)) {
		data.questions[selected_question].answers = [];
	}

	const get_empty_answer = (): Answer => {
		return {
			answer: '',
			right: false
		};
	};

	data.questions[selected_question].type =
		check_choice === true ? QuizQuestionType.CHECK : QuizQuestionType.ABCD;

	// Slot colour comes from the palette, which was derived for colour-vision separation
	// against both surfaces. It belongs to the slot, not to the answer: there is no
	// per-answer colour picker any more, because an author picking two near-identical hues
	// is exactly what the palette work was meant to prevent. Deriving it from the index
	// rather than storing it also keeps the order correct after an answer is deleted, and
	// it matches what every play surface already does (`answer.color ?? default_colors[i]`).
	// Quizzes authored before this still carry a hand-picked colour, which is honoured,
	// and is why the ink is measured rather than assumed.
	const slot_color = (answer: Answer, index: number): string =>
		answer.color ?? ANSWER_COLORS[index % ANSWER_COLORS.length];

	const remove_answer = (index: number) => {
		data.questions[selected_question].answers.splice(index, 1);
		data.questions[selected_question].answers = data.questions[selected_question].answers;
	};
</script>

<div class="grid w-full gap-3 sm:grid-cols-2">
	{#if Array.isArray(data.questions[selected_question].answers)}
		{#each data.questions[selected_question].answers as answer, index}
			{@const color = slot_color(answer, index)}
			{@const ink = get_foreground_color(color)}
			<div
				out:fade={{ duration: 150 }}
				class="group relative flex items-center gap-3 rounded-xl p-4 transition"
				class:ring-3={answer.right}
				class:ring-foreground={answer.right}
				style="background-color: {color}; color: {ink}"
			>
				<AnswerShape {index} class="size-6 shrink-0" />

				<input
					bind:value={answer.answer}
					type="text"
					class="min-w-0 flex-1 bg-transparent text-lg font-medium outline-none placeholder:opacity-60"
					style="color: {ink}"
					placeholder={$t('editor.enter_answer')}
				/>

				<button
					type="button"
					class="shrink-0 rounded-full border-2 p-1 transition focus-visible:ring-2 focus-visible:ring-current focus-visible:outline-none"
					style="border-color: {ink}; {answer.right
						? `background-color: ${ink}; color: ${color}`
						: 'background-color: transparent'}"
					aria-pressed={answer.right}
					title={$t('editor.mark_correct')}
					aria-label="{$t('editor.mark_correct')}: {answer.answer || $t('words.answer')}"
					onclick={() => {
						answer.right = !answer.right;
					}}
				>
					<Check class="size-4" style={answer.right ? '' : 'opacity:0.35'} />
				</button>

				<button
					class="absolute -top-2 -right-2 rounded-full border p-1 opacity-0 shadow-sm transition group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
					style="background-color: {color}; color: {ink}; border-color: {ink}"
					type="button"
					title={$t('editor.delete_answer')}
					aria-label={$t('editor.delete_answer')}
					onclick={() => remove_answer(index)}
				>
					<X class="size-3.5" />
				</button>
			</div>
		{/each}
	{/if}
	{#if data.questions[selected_question].answers.length < 4}
		<button
			class="border-border text-muted-foreground hover:border-primary/50 hover:bg-muted focus-visible:ring-ring flex items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 transition focus-visible:ring-2 focus-visible:outline-none"
			type="button"
			in:fade={{ duration: 150 }}
			onclick={() => {
				data.questions[selected_question].answers = [
					...data.questions[selected_question].answers,
					{ ...get_empty_answer() }
				];
			}}
		>
			<Plus class="size-4" />
			<span>{$t('editor_page.add_an_answer')}</span>
		</button>
	{/if}
</div>
