<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	// The open card's question type (#93). Multiple choice and Check choice are one entry
	// here: the card's One / Several choice already switches between them.
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { buttonVariants } from '$lib/components/ui/button';
	import { getLocalization } from '$lib/i18n';
	import { QuizQuestionType } from '$lib/quiz_types';
	import { TYPE_OF } from './new_question';
	import { QUESTION_TYPES, creatableTypes } from './question_types';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';

	const { t } = getLocalization();

	interface Props {
		type: QuizQuestionType | undefined;
		onchange: (to: QuizQuestionType) => void;
	}

	let { type, onchange }: Props = $props();

	const family = (t: QuizQuestionType | undefined) =>
		t === undefined || t === QuizQuestionType.CHECK ? QuizQuestionType.ABCD : t;

	const options = creatableTypes()
		.filter((qt) => qt.kind !== 'check' && qt.kind !== 'true_false')
		.map((qt) => ({ type: TYPE_OF[qt.kind], label: qt.label }));
	// A type that has been turned off still shows, by name, on a question that already uses it.
	const label_of = (ty: QuizQuestionType) =>
		QUESTION_TYPES.find((qt) => qt.kind !== 'check' && TYPE_OF[qt.kind] === ty)?.label ??
		'words.multiple_choice';
	const current = $derived({ type: family(type), label: label_of(family(type)) });
</script>

{#if options.length > 1}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger
			type="button"
			class={buttonVariants({ variant: 'outline', size: 'sm', class: 'gap-1.5' })}
			aria-label="{$t('editor.question_type')}: {$t(current.label)}"
		>
			{$t(current.label)}
			<ChevronDown class="size-4 opacity-60" aria-hidden="true" />
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="start" class="min-w-48">
			<DropdownMenu.RadioGroup
				value={current.type}
				onValueChange={(v) => {
					if (v && v !== current.type) onchange(v as QuizQuestionType);
				}}
			>
				{#each options as o (o.type)}
					<DropdownMenu.RadioItem value={o.type}>{$t(o.label)}</DropdownMenu.RadioItem>
				{/each}
			</DropdownMenu.RadioGroup>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/if}
