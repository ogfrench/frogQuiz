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
</script>

<!-- The narrow-screen form of the question rail. It is a sibling of the canvas in the
     editor shell, not an overlay: the quiz's shape and its order have to stay visible
     while you edit, which is exactly what a drawer takes away. Same job as the
     vertical aside at lg and up, laid out along the other axis. -->
<nav
	class="border-border bg-muted/30 flex shrink-0 items-center gap-2 border-b px-2 py-2 lg:hidden"
	aria-label={$t('editor.show_questions')}
>
	<!-- overflow-x:auto computes overflow-y to auto as well, so anything drawn outside
	     a child's border box is clipped. That is what cut the top and bottom off the
	     selected chip's ring. The rings are inset now, so there is nothing outside the
	     box to clip, and the scroller keeps a little padding so the focus ring has
	     somewhere to land too. -->
	<div
		bind:this={scroller}
		class="flex min-w-0 flex-1 items-stretch gap-2 overflow-x-auto p-1 scroll-smooth"
	>
		<button
			type="button"
			data-selected={selected_question === -1}
			class="border-border bg-card flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition
				{selected_question === -1 ? 'ring-primary bg-primary/5 ring-2 ring-inset' : ''}"
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
				class="border-border bg-card flex min-h-11 w-36 shrink-0 flex-col items-start justify-center gap-0.5 rounded-lg border px-3 py-2 text-left transition
					{selected ? 'ring-primary bg-primary/5 ring-2 ring-inset' : ''}"
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
