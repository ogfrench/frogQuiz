<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import type { Answer, EditorData } from '$lib/quiz_types';
	import { QuizQuestionType } from '$lib/quiz_types';
	import { dataSchema, fieldIsValid, SLIDE_BODY_MAX_LENGTH } from '$lib/yupSchemas';
	import { editorValidation } from '$lib/editor/validation.svelte';
	import { isQuestionComplete } from '$lib/editor/question_complete';
	import { htmlToPlainText } from '$lib/sanitize';
	import Spinner from '../Spinner.svelte';
	import { getLocalization } from '$lib/i18n';
	import MediaComponent from '$lib/editor/MediaComponent.svelte';
	import RangeEditor from '$lib/editor/RangeSelectorEditorPart.svelte';
	import QuestionTypeMenu from '$lib/editor/QuestionTypeMenu.svelte';
	import { convertQuestion, conversionLosesText } from '$lib/editor/convert_question';
	import { QUESTION_TYPES } from '$lib/editor/question_types';
	import { TYPE_OF } from '$lib/editor/new_question';
	import { Button } from '$lib/components/ui/button';
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import { buttonVariants } from '$lib/components/ui/button';
	import CircleDot from '@lucide/svelte/icons/circle-dot';
	import Clock from '@lucide/svelte/icons/clock';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Copy from '@lucide/svelte/icons/copy';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';

	const { t } = getLocalization();

	interface Props {
		data: EditorData;
		/** This card's question. Fixed for the card: the column renders one per question. */
		index: number;
		focused: boolean;
		edit_id: string;
		total: number;
		onselect: (index: number) => void;
		onmove: (from: number, to: number) => void;
		ondelete: (index: number) => void;
		onduplicate: (index: number) => void;
		ondragstart: (index: number) => void;
		ondragenter: (index: number) => void;
		ondragend: () => void;
		dragging: boolean;
	}

	let {
		data = $bindable(),
		index,
		focused,
		edit_id = $bindable(),
		total,
		onselect,
		onmove,
		ondelete,
		onduplicate,
		ondragstart,
		ondragenter,
		ondragend,
		dragging
	}: Props = $props();

	let confirm_delete = $state(false);
	// The type a pending change would switch to, while its confirmation is open.
	let pending_type: QuizQuestionType | null = $state(null);
	const change_type = (to: QuizQuestionType) => {
		if (conversionLosesText($state.snapshot(data.questions[index]), to)) pending_type = to;
		else apply_type(to);
	};
	const apply_type = (to: QuizQuestionType) => {
		data.questions[index] = convertQuestion($state.snapshot(data.questions[index]), to);
		pending_type = null;
	};
	const type_label = (ty: QuizQuestionType | null) =>
		$t(
			QUESTION_TYPES.find((qt) => qt.kind !== 'check' && TYPE_OF[qt.kind] === ty)?.label ??
				'words.multiple_choice'
		).toLowerCase();
	let uppyOpen = $state(false);

	const question = $derived(data.questions[index]);
	const type = $derived(question.type);
	// An old drawn slide keeps its drawing in `answers`; a plain slide (#93) has none, and
	// edits like a question: title, text, image. It has no timer, answers or results.
	const drawn_slide = $derived(
		type === QuizQuestionType.SLIDE &&
			typeof question.answers === 'string' &&
			question.answers !== ''
	);
	const plain_slide = $derived(type === QuizQuestionType.SLIDE && !drawn_slide);

	// The timer is a free-text number field, so it can hold anything the keyboard
	// produces. Clamp what the author can store rather than what the game has to cope with.
	// It is stored as a string, which is what the API takes: a number input bound with
	// bind:value hands back a number, and every edited timer made Save answer 422.
	const getTime = () => data.questions[index].time;
	const setTime = (time: string | number | null | undefined) => {
		data.questions[index].time =
			time === null || time === undefined ? '' : String(time).slice(0, 3);
	};

	const question_valid = $derived(
		// Marked only after the first Save (validation.svelte.ts): a new question is blank.
		!editorValidation.shown ||
			fieldIsValid(dataSchema, 'questions[].question', question.question)
	);
	const incomplete = $derived(editorValidation.shown && !isQuestionComplete(question));
	const summary = $derived(htmlToPlainText(question.question ?? '').trim());
	// Every list-shaped answer type has `answer`; only ABCD and CHECK have `right`.
	const answers = $derived(
		(Array.isArray(question.answers) ? question.answers : []) as {
			answer: string;
			right?: boolean;
		}[]
	);

	// Arrow keys on the grip move the question without a pointer at all, which is the
	// single-pointer alternative WCAG 2.5.7 asks for. Kept from the old rail.
	const on_grip_keydown = (e: KeyboardEvent) => {
		const delta = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
		if (delta === 0) return;
		e.preventDefault();
		e.stopPropagation();
		onmove(index, index + delta);
		const target = e.currentTarget as HTMLElement;
		requestAnimationFrame(() =>
			target
				.closest('[data-question-card]')
				?.querySelector<HTMLElement>('[data-grip]')
				?.focus()
		);
	};
</script>

<!-- One card per question in a single column, the way Google Forms and Kahoot both do
     it: the whole quiz is visible as a list, and the card you are working on opens in
     place. A collapsed card renders plain text on purpose -- the rich-text editor is a
     CKEditor instance, and twenty of them on one page is not an editor, it is a stall. -->
<article
	data-question-card
	data-question-index={index}
	class="border-border bg-card relative scroll-mt-24 rounded-xl border shadow-sm transition
	       {focused ? 'ring-primary/40 ring-2' : 'hover:border-border'}
	       {dragging ? 'opacity-40' : ''}"
	ondragover={(e) => {
		e.preventDefault();
		ondragenter(index);
	}}
	ondrop={(e) => {
		e.preventDefault();
		ondragend();
	}}
	aria-label={$t('editor.question_n_of_total', { n: index + 1, total })}
>
	<div class="flex items-start gap-1 p-2 sm:gap-2 sm:p-3">
		<!-- Only the grip starts a drag, so selecting text in the card does not drag it. -->
		<button
			type="button"
			data-grip
			draggable="true"
			ondragstart={() => ondragstart(index)}
			{ondragend}
			onkeydown={on_grip_keydown}
			class="fq-touch-target text-muted-foreground hover:text-foreground focus-visible:ring-ring relative mt-1 inline-flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
			aria-label={$t('editor.reorder_grip', { n: index + 1 })}
		>
			<GripVertical class="size-4" />
		</button>

		<div class="min-w-0 flex-1">
			{#if focused}
				<!-- Toolbar: what this question is, how long it runs, how it is answered. -->
				<div class="flex flex-wrap items-center gap-2 pt-1 pr-1 pb-3">
					<p class="text-muted-foreground text-sm font-medium">
						{$t('editor.question_n_of_total', { n: index + 1, total })}
					</p>
					<!-- The open card needs the marker as much as a closed one: after Save the
					     header says how many questions need finishing, and the author has to be
					     able to see which card they are standing in is one of them. -->
					{#if incomplete}
						<Badge variant="destructive">{$t('editor.question_incomplete')}</Badge>
					{/if}
					<div class="ml-auto flex flex-wrap items-center gap-1.5">
						<!-- The input inside drops its own outline, so the pill shows focus for it,
						     the way the shadcn Input does. Without this the only sign of focus was
						     the selected value, gone as soon as you typed. On touch the pill, not the
						     input, is the 44px press area: tapping a label focuses its input, and a
						     44px-tall input made the pill taller than the button beside it. -->
						{#if !plain_slide}
							<label
								class="fq-touch-target relative border-input bg-background text-muted-foreground focus-within:border-ring focus-within:ring-ring/50 flex min-h-9 items-center gap-1.5 rounded-md border px-2 py-1 text-sm transition-[color,box-shadow] focus-within:ring-3"
							>
								<Clock class="size-4" />
								<span class="sr-only">{$t('editor.time_in_seconds')}</span>
								<input
									type="number"
									max="999"
									min="1"
									class="text-foreground any-pointer-coarse:min-h-0 any-pointer-coarse:text-base w-10 bg-transparent text-right tabular-nums outline-none"
									bind:value={getTime, setTime}
								/>
								<span>s</span>
							</label>
						{/if}
						<QuestionTypeMenu {type} onchange={change_type} />
						{#if type === QuizQuestionType.ABCD || type === QuizQuestionType.CHECK}
							<!-- A choice in view rather than a button labeled with its current state,
							     which read as confirming it (V1 screens review, 17 Oct). -->
							<SegmentedControl
								legend={$t('editor.correct_answers')}
								legendHidden
								name="answers-{index}"
								options={[
									{
										value: 'one',
										label: $t('editor.answers_one'),
										icon: CircleDot
									},
									{
										value: 'several',
										label: $t('editor.answers_several'),
										icon: ListChecks
									}
								]}
								value={type === QuizQuestionType.CHECK ? 'several' : 'one'}
								onchange={(v) => {
									// "One correct answer" is only enforced when an answer is
									// marked, so switching to it used to keep every answer marked
									// under "Several". Keep the first and unmark the rest.
									if (v === 'one') {
										let kept = false;
										for (const answer of data.questions[index]
											.answers as Answer[]) {
											if (answer.right && kept) answer.right = false;
											else if (answer.right) kept = true;
										}
									}
									data.questions[index].type =
										v === 'one'
											? QuizQuestionType.ABCD
											: QuizQuestionType.CHECK;
								}}
							/>
						{/if}
					</div>
				</div>

				<!-- The body renders the question the way the room will see it, so there is no
				     gap between what the author builds and what gets projected. -->
				<div class="flex flex-col gap-5 pb-1">
					{#if drawn_slide}
						{#await import('./slide.svelte')}
							<Spinner my_20={false} />
						{:then c}
							<c.default bind:data={data.questions[index]} />
						{/await}
					{:else}
						{#await import('$lib/inline-editor.svelte')}
							<Spinner my_20={false} />
						{:then c}
							<div
								class="rounded-lg text-center text-xl font-semibold [&_[contenteditable]]:w-full"
								class:ring-2={!question_valid}
								class:ring-destructive={!question_valid}
							>
								<c.default
									bind:text={data.questions[index].question}
									label={$t('editor.question_text')}
								/>
							</div>
						{/await}

						{#if plain_slide}
							<!-- Plain text under the title on the projector; formatting comes from the
							     title, not from here. Capped where the server caps it. -->
							<textarea
								bind:value={
									() => data.questions[index].body ?? '',
									(v) => (data.questions[index].body = v)
								}
								rows="3"
								maxlength={SLIDE_BODY_MAX_LENGTH}
								aria-label={$t('editor.slide_text')}
								placeholder={$t('editor.slide_text_placeholder')}
								class="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-y rounded-md border px-3 py-2 text-base outline-none focus-visible:ring-3"
							></textarea>
						{/if}
						{#if question.image}
							<div class="relative mx-auto w-fit">
								<button
									class="fq-touch-target border-border bg-card text-muted-foreground hover:text-destructive focus-visible:ring-ring absolute -top-2 -right-2 z-10 rounded-full border p-1 shadow-sm transition focus-visible:ring-2 focus-visible:outline-none"
									type="button"
									title={$t('words.delete')}
									aria-label={$t('words.delete')}
									onclick={() => {
										data.questions[index].image = null;
									}}
								>
									<X class="size-4" />
								</button>
								<div class="h-56">
									<MediaComponent src={question.image} />
								</div>
							</div>
						{:else}
							{#await import('$lib/editor/uploader.svelte')}
								<Spinner my_20={false} />
							{:then c}
								<c.default
									bind:modalOpen={uppyOpen}
									bind:data
									selected_question={index}
									video_upload={false}
									library_enabled={false}
									pixabay_enabled={false}
								/>
							{/await}
						{/if}

						{#if type === QuizQuestionType.ABCD || type === QuizQuestionType.CHECK}
							{#await import('$lib/editor/ABCDEditorPart.svelte')}
								<Spinner my_20={false} />
							{:then c}
								<c.default
									bind:data
									selected_question={index}
									check_choice={type === QuizQuestionType.CHECK}
								/>
							{/await}
						{:else if type === QuizQuestionType.RANGE}
							<RangeEditor selected_question={index} bind:data />
						{:else if type === QuizQuestionType.VOTING}
							<!-- The choice tiles without a right answer to mark (#93). The old
							     VotingEditorPart threw the answers away on every open. -->
							{#await import('$lib/editor/ABCDEditorPart.svelte')}
								<Spinner my_20={false} />
							{:then c}
								{#key index}
									<c.default bind:data selected_question={index} poll />
								{/key}
							{/await}
						{:else if type === QuizQuestionType.TEXT}
							{#await import('$lib/editor/TextEditorPart.svelte')}
								<Spinner my_20={false} />
							{:then c}
								<c.default bind:data selected_question={index} />
							{/await}
						{:else if type === QuizQuestionType.ORDER}
							{#await import('$lib/editor/OrderEditorPart.svelte')}
								<Spinner my_20={false} />
							{:then c}
								<c.default bind:data selected_question={index} />
							{/await}
						{/if}
					{/if}
				</div>
			{:else}
				<!-- Collapsed: enough to recognize the question and see whether it is finished. -->
				<button
					type="button"
					class="focus-visible:ring-ring w-full rounded-lg px-1 py-2 text-left focus-visible:ring-2 focus-visible:outline-none"
					onclick={() => onselect(index)}
				>
					<span class="flex items-baseline gap-2">
						<span class="text-muted-foreground shrink-0 text-sm tabular-nums">
							{index + 1}
						</span>
						<span class="min-w-0 flex-1 truncate font-medium">
							{summary || $t('editor.no_title')}
						</span>
						{#if incomplete}
							<Badge variant="destructive" class="shrink-0">
								{$t('editor.question_incomplete')}
							</Badge>
						{/if}
					</span>
					{#if answers.length}
						<span class="mt-1.5 flex flex-wrap gap-1.5 pl-6">
							{#each answers.slice(0, 4) as answer, i (i)}
								<span
									class="bg-muted text-muted-foreground max-w-[12rem] truncate rounded-sm px-1.5 py-0.5 text-xs"
									class:font-medium={answer.right}
									class:text-foreground={answer.right}
								>
									{answer.right ? '✓ ' : ''}{htmlToPlainText(
										answer.answer ?? ''
									) || $t('editor.empty')}
								</span>
							{/each}
						</span>
					{/if}
				</button>
			{/if}
		</div>
	</div>

	<!-- Card actions sit in a footer on the open card, the way Forms and Kahoot both do
	     it: on the right of the content they are a third column, and at 390px a third
	     column leaves the question about 200px to live in. The closed card carries none
	     of them -- a list of twenty questions should read as a list, not as eighty
	     buttons. -->
	{#if focused}
		<div
			class="border-border any-pointer-coarse:gap-2 flex flex-wrap items-center justify-end gap-0.5 border-t px-2 py-1"
		>
			<!-- The question's one setting sits on the card, where you can see it is on (V1
			     menus review, 17 Oct). It was a gear icon opening a dialog for this one
			     switch. A function binding because older questions have no hide_results
			     at all, and binding a Switch to undefined throws. -->
			{#if type !== QuizQuestionType.SLIDE}
				<div class="mr-auto flex min-h-11 items-center gap-2.5 pl-2">
					<Switch
						id="hide-results-{index}"
						bind:checked={
							() => data.questions[index].hide_results === true,
							(v) => (data.questions[index].hide_results = v)
						}
						aria-describedby="hide-results-hint-{index}"
					/>
					<Label
						for="hide-results-{index}"
						class="text-sm font-normal"
						title={$t('editor.hide_question_results_hint')}
						>{$t('editor.hide_question_results')}</Label
					>
					<span id="hide-results-hint-{index}" class="sr-only"
						>{$t('editor.hide_question_results_hint')}</span
					>
				</div>
			{/if}
			<Button
				type="button"
				variant="ghost"
				size="icon"
				disabled={index === 0}
				aria-label={$t('editor.move_question_up')}
				title={$t('editor.move_question_up')}
				onclick={() => onmove(index, index - 1)}
			>
				<ChevronUp />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				disabled={index === total - 1}
				aria-label={$t('editor.move_question_down')}
				title={$t('editor.move_question_down')}
				onclick={() => onmove(index, index + 1)}
			>
				<ChevronDown />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				aria-label={$t('editor.duplicate_question')}
				title={$t('editor.duplicate_question')}
				onclick={() => onduplicate(index)}
			>
				<Copy />
			</Button>
			<!-- Deleting a question is the one action here that cannot be undone -- the
			     editor autosaves, so it is gone from the server moments later. It asks
			     first, like deleting a quiz does. -->
			<AlertDialog.Root bind:open={confirm_delete}>
				<!-- The whole editor is one <form>, so a button with no type submits it: the
				     trash icon saved the quiz and left for the view page instead of asking. -->
				<AlertDialog.Trigger
					type="button"
					class={buttonVariants({
						variant: 'ghost',
						size: 'icon',
						class: 'text-muted-foreground hover:text-destructive'
					})}
					aria-label={$t('editor.delete_question')}
					title={$t('editor.delete_question')}
				>
					<Trash2 />
				</AlertDialog.Trigger>
				<AlertDialog.Content class="max-w-md">
					<AlertDialog.Header>
						<AlertDialog.Title>{$t('editor.delete_question_confirm')}</AlertDialog.Title
						>
						<AlertDialog.Description>
							{summary || $t('editor.no_title')}
						</AlertDialog.Description>
					</AlertDialog.Header>
					<AlertDialog.Footer>
						<AlertDialog.Cancel type="button">{$t('words.cancel')}</AlertDialog.Cancel>
						<AlertDialog.Action
							type="button"
							variant="danger"
							onclick={() => ondelete(index)}
						>
							{$t('words.delete')}
						</AlertDialog.Action>
					</AlertDialog.Footer>
				</AlertDialog.Content>
			</AlertDialog.Root>
		</div>
	{/if}
	<!-- Changing type keeps what carries over (convert_question.ts) and asks only when it
	     would throw away something the author typed. Every button is type="button": the
	     editor is one form. -->
	<AlertDialog.Root
		open={pending_type !== null}
		onOpenChange={(open) => {
			if (!open) pending_type = null;
		}}
	>
		<AlertDialog.Content class="max-w-md">
			<AlertDialog.Header>
				<AlertDialog.Title
					>{$t('editor.change_type_title', {
						type: type_label(pending_type)
					})}</AlertDialog.Title
				>
				<AlertDialog.Description>
					{$t('editor.change_type_body', { type: type_label(pending_type) })}
				</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel type="button">{$t('words.cancel')}</AlertDialog.Cancel>
				<AlertDialog.Action
					type="button"
					onclick={() => pending_type && apply_type(pending_type)}
				>
					{$t('editor.change_type_confirm')}
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
</article>
