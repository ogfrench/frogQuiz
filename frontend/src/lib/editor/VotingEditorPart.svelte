<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { run } from 'svelte/legacy';
	import { ANSWER_COLORS } from '$lib/play/answer_colors';

	import type { EditorData, VotingAnswer } from '../quiz_types';
	import { fade } from 'svelte/transition';
	import { getLocalization } from '$lib/i18n';
	import { VotingQuestionSchema, fieldIsValid } from '$lib/yupSchemas';
	import { get_foreground_color } from '$lib/helpers';

	const { t } = getLocalization();

	const default_colors = ANSWER_COLORS;
	interface Props {
		selected_question: number;
		data: EditorData;
	}

	let { selected_question, data = $bindable() }: Props = $props();
	const answers = $derived(data.questions[selected_question].answers as VotingAnswer[]);

	if (!Array.isArray(data.questions[selected_question].answers)) {
		data.questions[selected_question].answers = [];
	}
	try {
		// Answers carried over from a multiple-choice question still have `right`.
		const first = (data.questions[selected_question].answers as VotingAnswer[])[0];
		if (typeof (first as { right?: boolean }).right === 'boolean') {
			data.questions[selected_question].answers = [];
		}
		// eslint-disable-next-line no-empty
	} catch {}

	const set_colors_if_unset = () => {
		for (let i = 0; i < answers.length; i++) {
			if (!answers[i].color) {
				answers[i].color = default_colors[i];
			}
		}
	};
	run(() => {
		set_colors_if_unset();
		data;
		selected_question;
	});
	/*console.log(answers, 'moIn!', answers.length);
    onMount(() => {
        for (let i = 0; i < answers; i++) {
            console.log(answers[i], 'iterate');
            answers[i].right = undefined;
        }
    });*/
</script>

<div class="grid grid-rows-2 grid-flow-col auto-cols-auto gap-4 w-full px-10">
	{#if Array.isArray(data.questions[selected_question].answers)}
		{#each answers as answer, index}
			<div
				out:fade={{ duration: 150 }}
				class="p-4 rounded-lg flex justify-center w-full transition relative"
				class:bg-yellow-500={!fieldIsValid(VotingQuestionSchema, 'answer', answer.answer)}
				class:dark:bg-gray-500={answer.answer}
				class:bg-gray-300={answer.answer}
			>
				<button
					class="rounded-full absolute -top-2 -right-2 opacity-70 hover:opacity-100 transition"
					type="button"
					onclick={() => {
						answers.splice(index, 1);
						data.questions[selected_question].answers = answers;
					}}
				>
					<svg
						class="w-6 h-6 bg-red-500 rounded-full"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</button>
				<input
					bind:value={answer.answer}
					type="text"
					class="border-b-2 border-dotted w-5/6 text-center rounded-lg"
					style="background-color: {answer.color ??
						'transparent'}; color: {get_foreground_color(answer.color)}"
					placeholder={$t('editor.empty')}
				/>
				<input
					class="rounded-lg p-1 border-black border"
					type="color"
					bind:value={answer.color}
					oncontextmenu={(e) => {
						e.preventDefault();
						answer.color = default_colors[index];
					}}
				/>
			</div>
		{/each}
	{/if}
	{#if answers.length < 4}
		<button
			class="p-4 rounded-lg bg-transparent border-gray-500 border-2 hover:bg-gray-300 transition dark:hover:bg-gray-600"
			type="button"
			in:fade={{ duration: 150 }}
			onclick={() => {
				data.questions[selected_question].answers = [
					...answers,
					{
						...{
							answer: '',
							image: undefined,
							color: default_colors[answers.length]
						}
					}
				];
			}}
		>
			<span class="italic text-center">{$t('editor_page.add_an_answer')}</span>
		</button>
	{/if}
</div>
