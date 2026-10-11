<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { onMount } from 'svelte';
	import Editor from '$lib/editor.svelte';
	import type { Question } from '$lib/quiz_types';
	import { page } from '$app/state';

	interface Data {
		public: boolean;
		title: string;
		description: string;
		questions: Question[];
	}

	let data: Data = $state();
	let quiz_id = $state(null);
	onMount(() => {
		const from_localstorage = localStorage.getItem('create_game');
		if (from_localstorage === null) {
			let title = page.url.searchParams.get('title');
			title ??= '';
			data = {
				description: '',
				public: false,
				title,
				questions: [
					/*					{
						type: QuizQuestionType.ABCD,
						question: '',
						time: '20',
						answers: [{ right: false, answer: '' }]
					}*/
				]
			};
		} else {
			data = JSON.parse(from_localstorage);
		}
	});
</script>

<svelte:head>
	<title>frogQuiz - Create</title>
</svelte:head>

{#if data !== undefined}
	<Editor bind:data {quiz_id} />
{/if}
