<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { EditorData, TextQuizAnswer } from '$lib/quiz_types';
	import { getLocalization } from '$lib/i18n';
	import { TextQuestionSchema, fieldIsValid } from '$lib/yupSchemas';
	import { createTippy } from 'svelte-tippy';

	interface Props {
		selected_question: number;
		data: EditorData;
	}

	let { selected_question, data = $bindable() }: Props = $props();
	const answers = $derived(data.questions[selected_question].answers as TextQuizAnswer[]);

	const { t } = getLocalization();

	if (!Array.isArray(data.questions[selected_question].answers)) {
		data.questions[selected_question].answers = [];
	}

	// Setup runs once, so it reads the question directly rather than the reactive alias.
	const initial = data.questions[selected_question].answers as TextQuizAnswer[];
	for (let i = 0; i < initial.length; i++) {
		initial[i] = {
			answer: initial[i].answer,
			case_sensitive: false
		};
	}

	const tippy = createTippy({
		arrow: true,
		animation: 'perspective-subtle'
	});

	const get_empty_answer = (): TextQuizAnswer => {
		return {
			answer: '',
			case_sensitive: false
		};
	};
</script>

<div class="grid grid-cols-2 gap-4 w-full px-10">
	{#if Array.isArray(data.questions[selected_question].answers)}
		{#each answers as answer, index}
			<div
				out:fade={{ duration: 150 }}
				class="p-4 rounded-lg flex justify-center w-full transition relative"
				class:dark:bg-gray-500={answer.answer}
				class:bg-gray-300={answer.answer}
				class:bg-yellow-500={!fieldIsValid(TextQuestionSchema, 'answer', answer.answer)}
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
					class="border-b-2 border-dotted w-5/6 text-center rounded-lg bg-transparent outline-hidden"
					placeholder={$t('editor.enter_answer')}
				/>
				<button
					type="button"
					onclick={() => {
						answer.case_sensitive = !answer.case_sensitive;
					}}
					use:tippy={{ content: 'Case sensitive?', placement: 'top' }}
				>
					{#if answer.case_sensitive}
						<svg
							class="w-6 h-6 inline-block"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					{:else}
						<svg
							class="w-6 h-6 inline-block"
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
					{/if}
				</button>
			</div>
		{/each}
	{/if}
	{#if answers.length < 4}
		<button
			class="p-4 rounded-lg bg-transparent border-gray-500 border-2 hover:bg-gray-300 transition dark:hover:bg-gray-600"
			type="button"
			in:fade={{ duration: 150 }}
			onclick={() => {
				data.questions[selected_question].answers = [...answers, { ...get_empty_answer() }];
			}}
		>
			<span class="italic text-center">{$t('editor_page.add_an_answer')}</span>
		</button>
	{/if}
</div>
