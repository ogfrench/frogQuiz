<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	function sortObjectbyValue(obj) {
		const ret = {};
		Object.keys(obj)
			.sort((a, b) => obj[b] - obj[a])
			.forEach((s) => (ret[s] = obj[s]));
		return ret;
	}

	interface Props {
		scores: any;
		question_results: Array<{
			username: string;
			answer: string;
			right: boolean;
			time_taken: number;
			score: number;
		}>;
		username: any;
	}

	let { scores = $bindable(), question_results, username }: Props = $props();
	let score_by_username = $state({});

	if (JSON.stringify(scores) === '{}') {
		for (const i of question_results) {
			scores[i.username] = 0;
		}
	}
	for (const i of question_results) {
		score_by_username[i.username] = i.score;
	}
	for (const username of Object.keys(score_by_username)) {
		scores[username] = (score_by_username[username] ?? 0) + (scores[username] ?? 0);
	}
	scores = scores;
	let sorted_scores = $derived(sortObjectbyValue(scores));
</script>

<!-- This laid itself out with `h-screen` + `m-auto`, which did two wrong things at
     once: 100vh is the wrong number on a phone, and a second full-height centring
     block inside the route's stage is what left the card visually off-centre with a
     dead half-screen under it. The card now only draws itself and lets the stage
     place it.
     Fixed light "paper" rather than the bg-card token, for the same reason the host
     results card is: it sits on the quiz author's own background colour, not the
     app theme, so in dark mode bg-card made it near-black on near-black. -->
<div
	class="mx-auto flex w-full max-w-xs flex-col items-center gap-1 rounded-2xl border border-neutral-200 bg-white px-8 py-6 text-center text-neutral-900 shadow-sm"
>
	<p class="text-4xl font-bold tabular-nums">
		+{score_by_username[username] ?? '0'}
	</p>
	<p class="text-sm text-neutral-500 tabular-nums">
		Total score: {sorted_scores[username] ?? '0'}
	</p>
</div>
