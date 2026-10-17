<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	// Type answer's accepted spellings (#93). Replaces TextEditorPart, which reset every
	// spelling's case switch each time the card opened, capped them at four and explained
	// the switch only in an English tooltip. Any spelling scores, matched tolerantly
	// (play/text_match.ts): case, spaces, accents and one typo on a longer word.
	import type { EditorData, TextQuizAnswer } from '$lib/quiz_types';
	import { getLocalization } from '$lib/i18n';
	import { ANSWER_MAX_LENGTH } from '$lib/yupSchemas';
	import { MAX_TEXT_SPELLINGS } from './question_complete';
	import { Input } from '$lib/components/ui/input';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';

	const { t } = getLocalization();

	interface Props {
		selected_question: number;
		data: EditorData;
	}

	let { selected_question, data = $bindable() }: Props = $props();
	const spellings = $derived(data.questions[selected_question].answers as TextQuizAnswer[]);

	const add = () => {
		data.questions[selected_question].answers = [
			...spellings,
			{ answer: '', case_sensitive: false }
		];
	};
	const remove = (i: number) => {
		data.questions[selected_question].answers = spellings.filter((_, j) => j !== i);
	};
</script>

<div class="flex flex-col gap-3">
	<p class="text-muted-foreground text-sm">{$t('editor.accepted_answers_hint')}</p>
	<ul class="flex flex-col gap-2">
		{#each spellings as spelling, i (i)}
			<li class="flex min-w-0 items-center gap-2">
				<Input
					bind:value={spelling.answer}
					maxlength={ANSWER_MAX_LENGTH}
					aria-label={$t('editor.accepted_answer_n', { n: i + 1 })}
					placeholder={i === 0 ? $t('editor.accepted_answer_placeholder') : ''}
					class="min-w-0 flex-1 text-base"
				/>
				<div class="flex shrink-0 items-center gap-1.5">
					<Switch
						id="case-{selected_question}-{i}"
						bind:checked={spelling.case_sensitive}
					/>
					<Label
						for="case-{selected_question}-{i}"
						class="text-muted-foreground text-sm font-normal"
						title={$t('editor.case_sensitive_hint')}
						>{$t('editor.case_sensitive')}</Label
					>
				</div>
				{#if spellings.length > 1}
					<Button
						type="button"
						variant="ghost"
						size="icon"
						class="text-muted-foreground hover:text-destructive shrink-0"
						aria-label={$t('editor.remove_accepted_answer', { n: i + 1 })}
						onclick={() => remove(i)}
					>
						<X />
					</Button>
				{/if}
			</li>
		{/each}
	</ul>
	{#if spellings.length < MAX_TEXT_SPELLINGS}
		<Button type="button" variant="outline" class="self-start border-dashed" onclick={add}>
			<Plus />
			{$t('editor.add_accepted_answer')}
		</Button>
	{/if}
</div>
