<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import Editor from '$lib/editor.svelte';
	import { getLocalization } from '$lib/i18n';
	import { navbarVisible } from '$lib/stores.svelte.ts';
	import { QuizQuestionType } from '$lib/quiz_types';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';

	navbarVisible.visible = false;

	const { t } = getLocalization();

	interface Data {
		public: boolean;
		title: string;
		description: string;
		questions: Question[];
	}

	interface Question {
		question: string;
		time: string;
		answers: Answer[];
	}

	interface Answer {
		right: boolean;
		answer: string;
	}

	let { data } = $props();
	let { quiz_id } = $state(data);
	let quiz_data: Data = $state();

	const get_quiz = async (): Promise<void> => {
		const response = await fetch(`/api/v1/quiz/get/${quiz_id}`);
		if (response.status === 404) {
			throw new Error('Quiz not found');
		} else if (response.status === 200) {
			let temp_data = await response.json();
			for (let i = 0; i < temp_data.questions.length; i++) {
				let question = temp_data.questions[i];
				if (question.type === undefined) {
					temp_data.questions[i].type = QuizQuestionType.ABCD;
				} else {
					temp_data.questions[i].type = QuizQuestionType[question.type];
				}
			}
			quiz_data = temp_data;
			return;
		}
	};
</script>

<svelte:head>
	<title>frogQuiz - Edit</title>
</svelte:head>
{#await get_quiz()}
	<div class="text-muted-foreground my-20 flex justify-center">
		<LoaderCircle class="size-8 animate-spin" aria-label="Loading" />
	</div>
{:then _}
	{#if quiz_data !== undefined}
		<Editor bind:data={quiz_data} submit_button_text={$t('words.save')} bind:quiz_id />
	{/if}
{:catch err}
	<div class="text-center">
		<h1 class="text-5xl font-bold">{err.message}</h1>
	</div>
{/await}
