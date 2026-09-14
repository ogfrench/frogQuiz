<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import type { Answers, Question } from '$lib/quiz_types';
	import { QuizQuestionType } from '$lib/quiz_types';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { getLocalization } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import X from '@lucide/svelte/icons/x';

	interface Props {
		questions: Question[];
		open: boolean;
		selected_question: number;
	}

	let {
		questions = $bindable(),
		open = $bindable(),
		selected_question = $bindable()
	}: Props = $props();

	const { t } = getLocalization();
	onMount(() => {
		document.body.addEventListener('keydown', close_start_game_if_esc_is_pressed);
		return () =>
			document.body.removeEventListener('keydown', close_start_game_if_esc_is_pressed);
	});
	const close_start_game_if_esc_is_pressed = (key: KeyboardEvent) => {
		if (key.code === 'Escape') {
			open = false;
		}
	};
	const on_parent_click = (e: Event) => {
		if (e.target === e.currentTarget) {
			open = false;
		}
	};

	// RANGE, TEXT, VOTING, ORDER and SLIDE were cut from the MVP: each one multiplies the
	// editor, the play screen, the results screen and the scoring path, and none of them is
	// what people run a live quiz for. True/false needs no type of its own -- it is an ABCD
	// question with two answers. Existing quizzes that already use a cut type still open and
	// still play; this list only governs what can be created from here.
	const question_types: {
		name: string;
		description: string;
		answers: Answers;
		type: QuizQuestionType;
	}[] = [
		{
			name: $t('words.multiple_choice'),
			description: $t('editor.abcd_description'),
			answers: [],
			type: QuizQuestionType.ABCD
		},
		{
			name: $t('words.check_choice'),
			description: $t('editor.check_choice_description'),
			answers: [],
			type: QuizQuestionType.CHECK
		}
	];

	const add_question = (index: number) => {
		const empty_question: Question = {
			type: question_types[index].type,
			time: '20',
			question: '',
			image: undefined,
			answers: question_types[index].answers
		};
		questions = [...questions, { ...empty_question }];
		selected_question = questions.length - 1;
		open = false;
	};
</script>

<!-- w-screen/h-screen here meant 100vw, which is wider than the page whenever there is a
     scrollbar. inset-0 is the correct way to fill a fixed overlay. -->
<div
	class="fixed inset-0 z-50 flex bg-black/50 p-4"
	onclick={on_parent_click}
	transition:fade={{ duration: 100 }}
>
	<div
		class="border-border bg-card m-auto flex w-full max-w-lg flex-col gap-5 rounded-xl border p-6 shadow-xl"
		role="dialog"
		aria-modal="true"
		aria-label={$t('editor.add_new_question')}
	>
		<div class="flex items-start justify-between gap-4">
			<h2 class="text-lg font-semibold">{$t('editor.add_new_question')}</h2>
			<Button
				variant="ghost"
				size="icon-sm"
				type="button"
				aria-label={$t('words.close')}
				onclick={() => (open = false)}
			>
				<X />
			</Button>
		</div>

		<div class="flex flex-col gap-2">
			{#each question_types as qt, i (qt.type)}
				<button
					type="button"
					class="border-border hover:border-primary/50 hover:bg-muted focus-visible:ring-ring rounded-lg border p-4 text-left transition focus-visible:ring-2 focus-visible:outline-none"
					onclick={() => {
						add_question(i);
					}}
				>
					<span class="font-medium">{qt.name}</span>
					<span class="text-muted-foreground mt-1 block text-sm">{qt.description}</span>
				</button>
			{/each}
		</div>
	</div>
</div>
