<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	// Slider's numbers (#93). Replaces RangeSelectorEditorPart, which drew the right range
	// on a pips slider with one label per step and let the author type bounds it never
	// checked. Whole numbers, a span of at most 10,000, the right answer inside it: the
	// same rule as the draft check (question_complete.ts) and the server.
	import type { EditorData, RangeQuizAnswer } from '$lib/quiz_types';
	import { getLocalization } from '$lib/i18n';
	import { MAX_SLIDER_SPAN } from './question_complete';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	const { t } = getLocalization();

	interface Props {
		selected_question: number;
		data: EditorData;
	}

	let { selected_question, data = $bindable() }: Props = $props();
	const range = $derived(data.questions[selected_question].answers as RangeQuizAnswer);

	// A number field hands back a number, or null while it is empty or half typed.
	const field = (key: keyof RangeQuizAnswer) => ({
		get: () => range[key],
		set: (v: number | null) => {
			(data.questions[selected_question].answers as RangeQuizAnswer)[key] =
				v === null || Number.isNaN(v) ? (null as unknown as number) : Math.trunc(v);
		}
	});
	const min = field('min');
	const max = field('max');
	const lo = field('min_correct');
	const hi = field('max_correct');

	// What is wrong, in words, or nothing.
	const problem = $derived.by(() => {
		const { min, max, min_correct, max_correct } = range;
		if ([min, max, min_correct, max_correct].some((n) => typeof n !== 'number'))
			return $t('editor.slider_fill_all');
		if (min >= max) return $t('editor.slider_min_below_max');
		if (max - min > MAX_SLIDER_SPAN)
			return $t('editor.slider_span', { span: MAX_SLIDER_SPAN.toLocaleString() });
		if (min_correct > max_correct) return $t('editor.slider_right_order');
		if (min_correct < min || max_correct > max) return $t('editor.slider_right_inside');
		return '';
	});

	const id = (k: string) => `slider-${selected_question}-${k}`;
</script>

<div class="flex flex-col gap-4">
	<fieldset class="grid grid-cols-2 gap-3">
		<legend class="text-muted-foreground mb-2 text-sm">{$t('editor.slider_range')}</legend>
		<div class="flex min-w-0 flex-col gap-1.5">
			<Label for={id('min')}>{$t('editor.slider_lowest')}</Label>
			<Input id={id('min')} type="number" step="1" bind:value={min.get, min.set} />
		</div>
		<div class="flex min-w-0 flex-col gap-1.5">
			<Label for={id('max')}>{$t('editor.slider_highest')}</Label>
			<Input id={id('max')} type="number" step="1" bind:value={max.get, max.set} />
		</div>
	</fieldset>
	<fieldset class="grid grid-cols-2 gap-3">
		<legend class="text-muted-foreground mb-2 text-sm"
			>{$t('editor.slider_right_answer')}</legend
		>
		<div class="flex min-w-0 flex-col gap-1.5">
			<Label for={id('lo')}>{$t('editor.slider_from')}</Label>
			<Input id={id('lo')} type="number" step="1" bind:value={lo.get, lo.set} />
		</div>
		<div class="flex min-w-0 flex-col gap-1.5">
			<Label for={id('hi')}>{$t('editor.slider_to')}</Label>
			<Input id={id('hi')} type="number" step="1" bind:value={hi.get, hi.set} />
		</div>
	</fieldset>
	<p class="text-sm {problem ? 'text-destructive' : 'text-muted-foreground'}" role="status">
		{problem || $t('editor.slider_hint')}
	</p>
</div>
