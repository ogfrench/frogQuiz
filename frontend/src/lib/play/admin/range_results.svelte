<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	// Slider's results on the projector (#93): the scale, the right range on it, and a dot
	// for every answer, stacked where answers land on the same spot. There was no view at
	// all; the round card showed the title and nothing under it.
	import type { Question, RangeQuizAnswer } from '$lib/quiz_types';
	import { getLocalization } from '$lib/i18n';

	const { t } = getLocalization();

	interface Props {
		data: { answer: string; right: boolean }[];
		question: Question;
	}

	let { data, question }: Props = $props();

	const range = question.answers as RangeQuizAnswer;
	const span = Math.max(1, range.max - range.min);
	const at = (v: number) =>
		((Math.min(range.max, Math.max(range.min, v)) - range.min) / span) * 100;
	const right = data.filter((d) => d.right).length;
	// One column per position, snapped to a whole percent so near answers stack rather than
	// overlap; the column's height is how many landed there.
	const columns = (() => {
		const by: Record<number, { pct: number; right: boolean; count: number }> = {};
		for (const d of data) {
			const v = Number(d.answer);
			if (!Number.isFinite(v)) continue;
			const pct = Math.round(at(v));
			by[pct] ??= { pct, right: d.right, count: 0 };
			by[pct].count++;
		}
		return Object.values(by);
	})();
	const tallest = Math.max(1, ...columns.map((c) => c.count));
	const exact = range.min_correct === range.max_correct;
</script>

<div class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 lg:max-w-4xl">
	<div class="flex flex-col items-center gap-1 text-center">
		<p class="text-2xl font-bold tabular-nums lg:text-4xl">
			{$t('admin_page.text_right_count', { right, total: data.length })}
		</p>
		<p class="text-lg font-semibold text-emerald-700 tabular-nums lg:text-2xl">
			{exact
				? range.min_correct.toLocaleString()
				: `${range.min_correct.toLocaleString()}\u2013${range.max_correct.toLocaleString()}`}
		</p>
	</div>
	<div class="relative h-32 w-full lg:h-40" aria-hidden="true">
		<!-- The right range, as a band behind the answers. -->
		<div
			class="absolute inset-y-0 rounded-md bg-emerald-100"
			style:left="{at(range.min_correct)}%"
			style:width="max(4px, {at(range.max_correct) - at(range.min_correct)}%)"
		></div>
		{#each columns as c (c.pct)}
			<div
				class="absolute bottom-0 flex w-3 -translate-x-1/2 flex-col-reverse gap-1 lg:w-4"
				style:left="{c.pct}%"
			>
				{#each Array(c.count) as _, i (i)}
					<span
						class="block aspect-square w-full rounded-full {c.right
							? 'bg-emerald-600'
							: 'bg-neutral-400'}"
						style:opacity={0.5 + (0.5 * (i + 1)) / tallest}
					></span>
				{/each}
			</div>
		{/each}
		<div class="absolute inset-x-0 bottom-0 h-0.5 translate-y-2 bg-neutral-300"></div>
	</div>
	<div class="flex justify-between text-sm text-neutral-500 tabular-nums lg:text-lg">
		<span>{range.min.toLocaleString()}</span>
		<span>{range.max.toLocaleString()}</span>
	</div>
</div>
