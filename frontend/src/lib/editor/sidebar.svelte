<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import type { EditorData } from '../quiz_types';
	import { QuizQuestionType } from '$lib/quiz_types';
	import { reach } from 'yup';
	import { ABCDQuestionSchema, dataSchema } from '../yupSchemas';
	import { createTippy } from 'svelte-tippy';
	import { getLocalization } from '$lib/i18n';
	import { isQuestionComplete } from '$lib/editor/question_complete';
	import AddNewQuestionPopup from '$lib/editor/AddNewQuestionPopup.svelte';
	import { fade } from 'svelte/transition';
	import { Button } from '$lib/components/ui/button';
	import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
	import Settings2 from '@lucide/svelte/icons/settings-2';
	import Check from '@lucide/svelte/icons/check';
	import Globe from '@lucide/svelte/icons/globe';
	import Lock from '@lucide/svelte/icons/lock';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';

	const { t } = getLocalization();

	interface Props {
		/** Drawer state below lg, where the rail is off-canvas. Ignored at lg and up. */
		open?: boolean;
		data: EditorData;
		selected_question?: any;
	}

	let {
		data = $bindable(),
		selected_question = $bindable(-1),
		open = $bindable(false)
	}: Props = $props();

	let reorder_mode = $state(false);

	const tippy = createTippy({
		arrow: true,
		animation: 'perspective-subtle',
		placement: 'right'
	});
	let arr_of_cards = $state(Array(data.questions.length));
	let propertyCard = $state();
	let add_new_question_popup_open = $state(false);

	const swapArrayElements = (arr, a: number, b: number) => {
		let _arr = [...arr];
		let temp = _arr[a];
		_arr[a] = _arr[b];
		_arr[b] = temp;
		return _arr;
	};

	const setSelectedQuestion = (index: number): void => {
		if (reorder_mode) {
			return;
		}
		selected_question = index;
		if (index === -1) {
			propertyCard.scrollIntoView({
				behavior: 'smooth'
			});
		} else {
			arr_of_cards[index].scrollIntoView({
				behavior: 'smooth'
			});
		}
	};
	/*	onMount(() => {
            propertyCard.scrollIntoView({
                behavior: 'smooth'
            });
        });*/
</script>

<!-- Below lg the rail is an off-canvas drawer: a fixed w-72 rail on a 390px phone
     leaves about 118px of canvas, which is not an editor. At lg and up it is a
     static column again. The scrim is a sibling so it never covers the rail. -->
{#if open}
	<button
		type="button"
		class="fixed inset-0 z-30 bg-black/50 lg:hidden"
		aria-label={$t('words.close')}
		onclick={() => (open = false)}
	></button>
{/if}
<div
	class="border-border bg-background lg:bg-muted/30 fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col
		border-r transition-transform duration-200 lg:static lg:z-auto lg:w-64 lg:max-w-none lg:translate-x-0 xl:w-72"
	class:translate-x-0={open}
	class:-translate-x-full={!open}
>
	<div class="border-border flex h-14 shrink-0 items-center gap-2 border-b px-3">
		<Button
			class="min-w-0 flex-1"
			type="button"
			variant={reorder_mode ? 'default' : 'outline'}
			size="sm"
			onclick={() => (reorder_mode = !reorder_mode)}
		>
			<ArrowUpDown />
			{#if reorder_mode}{$t('editor.disable_reorder')}{:else}{$t(
					'editor.enable_reorder'
				)}{/if}
		</Button>
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			class="shrink-0 lg:hidden"
			aria-label={$t('words.close')}
			onclick={() => (open = false)}
		>
			<X />
		</Button>
	</div>
	<div class="min-h-0 flex-1 overflow-y-auto p-3">
		<div
			bind:this={propertyCard}
			class="border-border bg-card mb-3 rounded-lg border p-2 transition hover:cursor-pointer"
			class:ring-2={selected_question === -1}
			class:ring-primary={selected_question === -1}
			onclick={() => setSelectedQuestion(-1)}
		>
			<p class="text-muted-foreground mb-2 flex items-center gap-2 text-xs font-medium">
				<Settings2 class="size-3.5" />
				{$t('editor.quiz_setup')}
			</p>
			<div
				use:tippy={{ content: data.title === '' ? "It's empty!" : data.title }}
				class="border-border m-1 rounded-md border p-1 transition"
				class:ring-2={!reach(dataSchema, 'title').isValidSync(data.title)}
				class:ring-destructive={!reach(dataSchema, 'title').isValidSync(data.title)}
			>
				<p
					type="text"
					class="w-full truncate rounded-sm bg-transparent text-center whitespace-nowrap"
				>
					{#if data.title}
						{@html data.title}
					{:else}
						<i>{$t('editor.no_title')}</i>
					{/if}
				</p>
			</div>
			<div
				use:tippy={{ content: data.description === '' ? "It's empty!" : data.description }}
				class="border-border m-1 rounded-md border p-1 transition"
				class:ring-2={!reach(dataSchema, 'description').isValidSync(data.description)}
				class:ring-destructive={!reach(dataSchema, 'description').isValidSync(
					data.description
				)}
			>
				<textarea
					bind:value={data.description}
					class="w-full resize-none rounded-sm bg-transparent text-sm"
				></textarea>
			</div>
			<div class="flex w-full justify-center">
				<button
					type="button"
					onclick={() => {
						data.public = !data.public;
					}}
					class="text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition"
				>
					{#if data.public}
						<Globe class="inline-block size-4" />
						<span>{$t('words.public')}</span>
					{:else}
						<Lock class="inline-block size-4" />
						<span>{$t('words.private')}</span>
					{/if}
				</button>
			</div>
		</div>
		{#each data.questions as question, index}
			<div
				class="border-border bg-card relative mb-3 rounded-lg border p-2 transition hover:cursor-pointer"
				class:ring-2={index === selected_question}
				class:ring-primary={index === selected_question}
				onclick={() => {
					setSelectedQuestion(index);
				}}
				bind:this={arr_of_cards[index]}
			>
				{#if reorder_mode}
					<div
						transition:fade|global={{ duration: 90 }}
						class="absolute z-10 grid grid-cols-2 bg-transparent w-full rounded-sm h-full"
					>
						<!-- Div is used, since it just put me on the dashboard when using button elements... Idk why and I hate it-->
						<div
							class="h-full"
							role="button"
							aria-label="Move card up"
							class:opacity-50={index === 0}
							class:pointer-events-none={index === 0}
							onclick={() =>
								(data.questions = swapArrayElements(
									data.questions,
									index,
									index - 1
								))}
						>
							<!-- heroicons/new/ChevronUp --><svg
								data-slot="icon"
								aria-hidden="true"
								fill="none"
								stroke-width="1.5"
								stroke="currentColor"
								viewBox="0 0 24 24"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="m4.5 15.75 7.5-7.5 7.5 7.5"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
						</div>
						<div
							class="h-full"
							role="button"
							aria-label="Move card down"
							class:opacity-50={index + 1 === data.questions.length}
							class:pointer-events-none={index + 1 === data.questions.length}
							onclick={() =>
								(data.questions = swapArrayElements(
									data.questions,
									index,
									index + 1
								))}
						>
							<!-- heroicons/new/ChevronDown -->
							<svg
								data-slot="icon"
								aria-hidden="true"
								fill="none"
								stroke-width="1.5"
								stroke="currentColor"
								viewBox="0 0 24 24"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="m19.5 8.25-7.5 7.5-7.5-7.5"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
						</div>
					</div>
				{/if}
				<button
					class="border-border bg-card text-muted-foreground hover:text-destructive focus-visible:ring-ring absolute -top-2 -right-2 rounded-full border p-1 shadow-sm transition focus-visible:ring-2 focus-visible:outline-none"
					type="button"
					title={$t('editor.delete_question')}
					aria-label={$t('editor.delete_question')}
					onclick={() => {
						if (confirm('Do you really want to delete this Question?')) {
							selected_question = -1;
							data.questions.splice(index, 1);
							data.questions = data.questions;
						}
					}}
				>
					<X class="size-4" />
				</button>
				<div
					use:tippy={{
						content: question.question === '' ? 'No title' : question.question
					}}
					class="mb-2 flex items-center gap-2"
				>
					<span class="text-muted-foreground w-4 shrink-0 text-xs tabular-nums"
						>{index + 1}</span
					>
					{#if !isQuestionComplete(question)}
						<span
							class="bg-destructive size-2 shrink-0 rounded-full"
							title={$t('editor.question_incomplete')}
						></span>
						<span class="sr-only">{$t('editor.question_incomplete')}</span>
					{/if}
					<p class="min-w-0 flex-1 truncate text-sm">
						{#if question.question === ''}
							<span class="text-muted-foreground italic">{$t('editor.no_title')}</span
							>
						{:else}
							{@html question.question}
						{/if}
					</p>
				</div>
				{#if question.image}
					<div class="flex justify-center align-middle pb-0.5">
						<img
							src="/api/v1/storage/download/{question.image}"
							class="h-10 border rounded-lg"
							alt="Not available"
							use:tippy={{
								content: `<img src="/api/v1/storage/download/${question.image}" alt="Not available" class="rounded-sm">`,
								allowHTML: true
							}}
						/>
					</div>
				{/if}

				{#if question.type === QuizQuestionType.ABCD || question.type === QuizQuestionType.CHECK}
					<div class="grid grid-cols-2 gap-2">
						{#if Array.isArray(question.answers)}
							{#each question.answers as answer}
								<span
									class="flex items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-sm whitespace-nowrap {answer.right
										? 'border-primary/40 bg-primary/10'
										: 'border-border bg-muted text-muted-foreground'}"
									class:ring-2={!reach(ABCDQuestionSchema, 'answer').isValidSync(
										answer.answer
									)}
									class:ring-destructive={!reach(
										ABCDQuestionSchema,
										'answer'
									).isValidSync(answer.answer)}
									use:tippy={{
										content:
											answer.answer === ''
												? $t('editor.empty')
												: answer.answer
									}}
								>
									{#if answer.right}<Check class="size-3 shrink-0" />{/if}
									<span class="truncate"
										>{#if answer.answer === ''}<i>{$t('editor.empty')}</i
											>{:else}{answer.answer}{/if}</span
									>
								</span>
							{/each}
						{/if}
					</div>
				{:else if question.type === QuizQuestionType.RANGE}
					<p class="text-center text-sm p-0.5">
						All numbers between {question.answers.min_correct}
						and {question.answers.max_correct} are correct, where numbers between {question
							.answers.min} and {question.answers.max} can be selected.
					</p>
				{:else if question.type === QuizQuestionType.VOTING || question.type === QuizQuestionType.TEXT}
					{#if Array.isArray(question.answers)}
						<div class="grid grid-cols-2 gap-2">
							{#each question.answers as answer}
								<span
									class="border-border bg-muted text-muted-foreground truncate rounded-md border px-1.5 py-0.5 text-center text-sm whitespace-nowrap"
									class:ring-2={!reach(ABCDQuestionSchema, 'answer').isValidSync(
										answer.answer
									)}
									class:ring-destructive={!reach(
										ABCDQuestionSchema,
										'answer'
									).isValidSync(answer.answer)}
									use:tippy={{
										content:
											answer.answer === ''
												? $t('editor.empty')
												: answer.answer
									}}
									>{#if answer.answer === ''}
										<i>{$t('editor.empty')}</i>
									{:else}
										{answer.answer}
									{/if}</span
								>
							{/each}
						</div>
					{/if}
				{:else if question.type === QuizQuestionType.SLIDE}
					<p>Some smart information on a slide</p>
				{:else if question.type === QuizQuestionType.ORDER}
					<p>Get thing's into the right order!</p>
				{:else}
					<p>Unknown Question Type (shouldn't happen)</p>
				{/if}
			</div>
		{/each}
		<Button
			class="w-full"
			type="button"
			variant="outline"
			onclick={() => {
				add_new_question_popup_open = true;
			}}
		>
			<Plus />
			{$t('editor.add_new_question')}
		</Button>
	</div>
</div>
{#if add_new_question_popup_open}
	<AddNewQuestionPopup
		bind:questions={data.questions}
		bind:open={add_new_question_popup_open}
		bind:selected_question
	/>
{/if}
