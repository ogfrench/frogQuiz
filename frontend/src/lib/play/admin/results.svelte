<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import VotingResults from './voting_results.svelte';
	import type { Question } from '$lib/quiz_types';
	import { QuizQuestionType } from '$lib/quiz_types';
	import { sanitizeTitleHtml } from '$lib/sanitize';

	interface Props {
		question: Question;
		new_data: Array<{
			username: string;
			answer: string;
			right: boolean;
			time_taken: number;
			score: number;
		}>;
	}

	// The answers only. It used to add this question's points to the host's totals when
	// it mounted, so a question with no results screen (hide results) never reached the
	// live scoreboard. The totals come from the server now (`scores`, admin.svelte).
	let { question, new_data }: Props = $props();
</script>

<div class="fq-stage">
	<!-- What the answer was and how the room split. Where that leaves the standings is
	     the next screen (scoreboard.svelte), which the host advances into.
	     This card is a fixed light "paper" surface rather than the bg-card token --
	     it sits on the quiz author's own background color, not the app's theme, so
	     in dark mode bg-card made it near-black with equally dark text, unreadable
	     regardless of what color the game background happened to be. -->
	<div
		class="w-full max-w-2xl overflow-hidden rounded-2xl border border-neutral-200 bg-white text-neutral-900 shadow-sm lg:max-w-4xl"
	>
		<!-- CHECK was missing from this list, so after a multiple-answer question the
		     projector showed an empty card: no question, no correct answers, no split.
		     VotingResults already counted CHECK submissions; nothing ever rendered it. -->
		{#if [QuizQuestionType.ABCD, QuizQuestionType.CHECK, QuizQuestionType.VOTING, QuizQuestionType.TEXT].includes(question.type)}
			<section class="flex flex-col gap-[var(--fq-space-group)] p-6 sm:p-8">
				<!-- This screen is read from the back of a room, not from a laptop: the question
				     screen before it sets its type at ~90px and this one was still at 18px. -->
				<h1
					class="text-center text-lg font-semibold tracking-tight text-balance wrap-anywhere lg:text-3xl"
				>
					{@html sanitizeTitleHtml(question.question)}
				</h1>
				<VotingResults data={new_data} {question} />
			</section>
		{/if}
	</div>
</div>
