<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { run } from 'svelte/legacy';

	import type { EditorData, RangeQuizAnswer } from '../quiz_types';
	import Spinner from '../Spinner.svelte';

	interface Props {
		selected_question: number;
		data: EditorData;
	}

	let { selected_question, data = $bindable() }: Props = $props();
	const answers = $derived(data.questions[selected_question].answers as RangeQuizAnswer);

	let question = data.questions[selected_question];
	const initial = question.answers as RangeQuizAnswer;
	if (initial.max === undefined || initial.min_correct === undefined) {
		question.answers = {
			max: 10,
			min: 0,
			max_correct: 7,
			min_correct: 3
		};
	}

	let answer = question.answers as RangeQuizAnswer;
	let range_arr = $state([answer.min_correct, answer.max_correct]);
	run(() => {
		answers.min_correct = range_arr[0];
	});
	run(() => {
		answers.max_correct = range_arr[1];
	});
	run(() => {
		answers.min = answers.min === null ? 0 : answers.min;
	});
	run(() => {
		answers.max = answers.max === null ? 0 : answers.max;
	});

	function sleep(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
</script>

<div class="w-full mx-8">
	<div class="flex justify-center">
		<div class="grid grid-cols-2 gap-4">
			<input
				type="number"
				class="w-16 bg-transparent rounded-lg text-lg border-2 border-gray-500 p-1"
				max={answers.max - 2}
				bind:value={answers.min}
			/>
			<input
				type="number"
				class="w-16 bg-transparent rounded-lg text-lg border-2 border-gray-500 p-1"
				min={answers.min + 2}
				bind:value={answers.max}
			/>
		</div>
	</div>
	<div class="w-full">
		<!--		<RangeSlider bind:value={range_arr} bind:min={answer.min} bind:max={answer.max} range={true} slider={lol} /> -->

		{#await import('svelte-range-slider-pips')}
			<Spinner my_20={false} />
		{:then c}
			{#await sleep(100)}
				<Spinner my_20={false} />
			{:then _}
				<c.default
					bind:values={range_arr}
					bind:min={answers.min}
					bind:max={answers.max}
					pips
					float
					all="label"
					range
				/>
			{/await}
		{/await}
	</div>
</div>
