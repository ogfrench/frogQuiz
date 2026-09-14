<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import type { EditorData } from '../quiz_types';
	import { getLocalization } from '$lib/i18n';
	import { isQuestionComplete } from '$lib/editor/question_complete';
	import AddNewQuestionPopup from '$lib/editor/AddNewQuestionPopup.svelte';
	import { Button } from '$lib/components/ui/button';
	import Settings2 from '@lucide/svelte/icons/settings-2';
	import Plus from '@lucide/svelte/icons/plus';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

	interface Props {
		data: EditorData;
		selected_question: number;
	}

	let { data = $bindable(), selected_question = $bindable(-1) }: Props = $props();

	const { t } = getLocalization();

	let add_open = $state(false);
	let scroller: HTMLElement | undefined = $state();

	// Keep the chosen chip in view when the selection moves, including when it moves
	// because a question was reordered out from under the thumb.
	$effect(() => {
		selected_question;
		scroller
			?.querySelector('[data-selected="true"]')
			?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
	});

	const move = (index: number, delta: number) => {
		const to = index + delta;
		if (to < 0 || to >= data.questions.length) return;
		const next = [...data.questions];
		[next[index], next[to]] = [next[to], next[index]];
		data.questions = next;
		selected_question = to;
	};
</script>

<!-- The narrow-screen form of the question rail. It is a sibling of the canvas in the
     editor shell, not an overlay: the quiz's shape and its order have to stay visible
     while you edit, which is exactly what a drawer takes away. Same job as the
     vertical aside at lg and up, laid out along the other axis. -->
<nav
	class="border-border bg-muted/30 flex shrink-0 items-center gap-2 border-b px-2 py-2 lg:hidden"
	aria-label={$t('editor.show_questions')}
>
	<div
		bind:this={scroller}
		class="flex min-w-0 flex-1 items-stretch gap-2 overflow-x-auto scroll-smooth"
	>
		<button
			type="button"
			data-selected={selected_question === -1}
			class="border-border bg-card flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition
				{selected_question === -1 ? 'ring-primary ring-2' : ''}"
			onclick={() => (selected_question = -1)}
		>
			<Settings2 class="size-3.5 shrink-0" />
			{$t('editor.quiz_setup')}
		</button>

		{#each data.questions as question, index (index)}
			{@const selected = index === selected_question}
			<button
				type="button"
				data-selected={selected}
				class="border-border bg-card flex w-36 shrink-0 flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left transition
					{selected ? 'ring-primary ring-2' : ''}"
				onclick={() => (selected_question = index)}
			>
				<span class="flex w-full items-center gap-1.5">
					<span class="text-muted-foreground text-xs tabular-nums">{index + 1}</span>
					{#if !isQuestionComplete(question)}
						<span
							class="bg-destructive size-1.5 shrink-0 rounded-full"
							title={$t('editor.question_incomplete')}
						></span>
						<span class="sr-only">{$t('editor.question_incomplete')}</span>
					{/if}
					{#if selected}
						<!-- Reordering lives on the selected chip rather than behind a mode
						     toggle: on a touch screen a drag handle in a horizontal scroller
						     fights the scroll gesture. -->
						<span class="ml-auto flex items-center gap-0.5">
							<span
								role="button"
								tabindex="0"
								aria-label={$t('editor.move_question_left')}
								class="hover:bg-muted rounded p-0.5 {index === 0
									? 'pointer-events-none opacity-30'
									: ''}"
								onclick={(e) => {
									e.stopPropagation();
									move(index, -1);
								}}
								onkeydown={(e) => e.key === 'Enter' && move(index, -1)}
							>
								<ChevronLeft class="size-3.5" />
							</span>
							<span
								role="button"
								tabindex="0"
								aria-label={$t('editor.move_question_right')}
								class="hover:bg-muted rounded p-0.5 {index ===
								data.questions.length - 1
									? 'pointer-events-none opacity-30'
									: ''}"
								onclick={(e) => {
									e.stopPropagation();
									move(index, 1);
								}}
								onkeydown={(e) => e.key === 'Enter' && move(index, 1)}
							>
								<ChevronRight class="size-3.5" />
							</span>
						</span>
					{/if}
				</span>
				<span class="w-full truncate text-xs">
					{#if question.question === ''}
						<span class="text-muted-foreground italic">{$t('editor.no_title')}</span>
					{:else}
						{@html question.question}
					{/if}
				</span>
			</button>
		{/each}
	</div>

	<Button
		type="button"
		variant="outline"
		size="icon"
		class="shrink-0"
		aria-label={$t('editor.add_new_question')}
		onclick={() => (add_open = true)}
	>
		<Plus />
	</Button>
</nav>

{#if add_open}
	<AddNewQuestionPopup
		bind:questions={data.questions}
		bind:open={add_open}
		bind:selected_question
	/>
{/if}
