<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import VotingResults from './voting_results.svelte';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import { onMount } from 'svelte';
	import { getLocalization } from '$lib/i18n';
	import type { Question } from '$lib/quiz_types';
	import { QuizQuestionType } from '$lib/quiz_types';

	const { t } = getLocalization();

	interface Props {
		data: any;
		question: Question;
		new_data: Array<{
			username: string;
			answer: string;
			right: boolean;
			time_taken: number;
			score: number;
		}>;
	}

	let { data = $bindable(), question, new_data }: Props = $props();

	// let data_by_username = {};

	const group_username_by_score = (_new_d: any[]): object => {
		let ret_data = {};
		for (const i of new_data) {
			ret_data[i.username] = i.score;
		}
		return ret_data;
	};
	let score_by_username = $derived(group_username_by_score(new_data));

	let player_names = $derived(Object.keys(data).sort((a, b) => {
		const scoreA = parseFloat(data[a]) || 0;
		const scoreB = parseFloat(data[b]) || 0;
		return scoreB - scoreA;
	}));

	if (JSON.stringify(data) === '{}') {
		for (const i of new_data) {
			data[i.username] = 0;
		}
	}

	let top_players = $derived(player_names.slice(0, 4));

	let show_new_score_clicked = $state(false);

	const show_new_score = () => {
		for (const i of player_names) {
			if (isNaN(data[i])) {
				data[i] = 0;
			}
			console.log(score_by_username[i], '1');
			data[i] = (score_by_username[i] ?? 0) + data[i];
		}
		for (const i of new_data) {
			if (!data[i.username]) {
				data[i.username] = score_by_username[i.username];
			}
		}
		show_new_score_clicked = true;
		setTimeout(() => {
			data = data;
		}, 800);
	};

	onMount(() => {
		setTimeout(show_new_score, 1000);
	});

	// https://svelte.dev/repl/96a58afdea2248a5b7e489160ffba887?version=3.44.2
</script>

<div class="fq-stage">
	<!-- One composition, in the order the room cares about: what the answer was
	     and how the room split, then where that leaves the standings. -->
	<div class="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
		{#if [QuizQuestionType.ABCD, QuizQuestionType.VOTING, QuizQuestionType.TEXT].includes(question.type)}
			<section class="flex flex-col gap-[var(--fq-space-group)] p-6 sm:p-8">
				<h2 class="text-center text-lg font-semibold tracking-tight text-balance">
					{@html question.question}
				</h2>
				<VotingResults data={new_data} {question} />
			</section>
		{/if}

		<section class="border-t border-border">
			<table class="w-full text-left text-base">
				<thead
					class="bg-muted/50 text-xs font-medium uppercase tracking-wider text-muted-foreground"
				>
					<tr>
						<th class="px-6 py-3">{$t('words.name')}</th>
						<th class="px-6 py-3 text-right">{$t('words.point', { count: 2 })}</th>
						{#if show_new_score_clicked}
							<th in:fly|global={{ x: 80 }} class="px-6 py-3 text-right">
								{$t('play_page.points_added')}
							</th>
						{/if}
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#each top_players as player (player)}
						<tr animate:flip={{ duration: 400 }}>
							<td class="px-6 py-3 font-medium">{player}</td>
							<td class="px-6 py-3 text-right tabular-nums">{data[player]}</td>
							{#if show_new_score_clicked}
								<td
									in:fly|global={{ x: 80 }}
									class="px-6 py-3 text-right font-medium tabular-nums"
									class:text-muted-foreground={!score_by_username[player]}
								>
									+{score_by_username[player] ?? '0'}
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	</div>
</div>
