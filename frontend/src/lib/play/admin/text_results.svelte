<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	// Type answer's results on the projector (#93): how many got it, what counted, and what
	// else people typed. It went through the poll chart, which counted only exact matches
	// against the accepted spellings, so "paris" for "Paris" scored and added to no bar, and
	// nobody saw what the room actually typed.
	import type { Question, TextQuizAnswer } from '$lib/quiz_types';
	import { normalize } from '$lib/play/text_match';
	import Check from '@lucide/svelte/icons/check';
	import { getLocalization } from '$lib/i18n';

	const { t } = getLocalization();

	interface Props {
		data: { answer: string; right: boolean }[];
		question: Question;
	}

	let { data, question }: Props = $props();

	/** The most wrong answers shown; the rest are on the spreadsheet. */
	const SHOWN = 8;

	const accepted = (question.answers as TextQuizAnswer[])
		.map((a) => a.answer)
		.filter((a) => a.trim());
	const right = data.filter((d) => d.right).length;
	// Grouped as the matcher sees them, so "Porto" and "porto " are one line; shown as the
	// first person typed it.
	const wrong = (() => {
		const groups: Record<string, { text: string; count: number }> = {};
		for (const d of data) {
			if (d.right) continue;
			const key = normalize(d.answer ?? '');
			if (!key) continue;
			groups[key] ??= { text: (d.answer ?? '').trim(), count: 0 };
			groups[key].count++;
		}
		return Object.values(groups).sort((a, b) => b.count - a.count);
	})();
</script>

<div class="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 lg:max-w-4xl">
	<div class="flex flex-col items-center gap-2 text-center">
		<p class="text-2xl font-bold tabular-nums lg:text-4xl">
			{$t('admin_page.text_right_count', { right, total: data.length })}
		</p>
		<p class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-lg lg:text-2xl">
			{#each accepted as a, i (i)}
				<span
					class="inline-flex items-center gap-1.5 font-semibold text-emerald-700 wrap-anywhere"
				>
					<Check class="size-5 shrink-0" aria-hidden="true" />{a}
				</span>
			{/each}
		</p>
	</div>
	{#if wrong.length > 0}
		<div class="flex flex-col gap-2">
			<p class="text-center text-sm font-medium text-neutral-500 lg:text-base">
				{$t('admin_page.text_also_typed')}
			</p>
			<ul class="flex flex-wrap justify-center gap-2">
				{#each wrong.slice(0, SHOWN) as w, i (i)}
					<li
						class="flex max-w-full items-center gap-2 rounded-full bg-neutral-100 px-4 py-1.5 text-base lg:text-xl"
					>
						<span class="min-w-0 wrap-anywhere">{w.text}</span>
						<span class="font-semibold tabular-nums text-neutral-500">{w.count}</span>
					</li>
				{/each}
				{#if wrong.length > SHOWN}
					<li class="px-2 py-1.5 text-base text-neutral-500 lg:text-xl">
						{$t('admin_page.more_players', { count: wrong.length - SHOWN })}
					</li>
				{/if}
			</ul>
		</div>
	{/if}
</div>
