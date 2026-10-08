<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { getLocalization } from '$lib/i18n';
	import { ANSWER_COLORS } from '$lib/play/answer_colors';
	import { socket } from './socket';
	import { QuizQuestionType } from '$lib/quiz_types';
	import Spinner from '$lib/Spinner.svelte';
	import Controls from '$lib/play/admin/controls.svelte';
	import Question from '$lib/play/admin/question.svelte';
	import { SocketGameControls } from '$lib/play/admin/socket_game_controls.ts';
	import type { IGameState } from '$lib/play/admin/game_state.ts';
	import { totalsFromResults } from '$lib/play/admin/totals';
	import { nextStep, performStep, stepState } from '$lib/play/admin/next_step';
	import { sanitizeTitleHtml } from '$lib/sanitize';

	const { t } = getLocalization();
	const default_colors = ANSWER_COLORS;

	let final_results_clicked = $state(false);
	let timer_interval: NodeJS.Timeout;

	interface Props {
		game_token: string;
		bg_color: string;
		game_state: IGameState;
	}

	let { game_token, bg_color, game_state = $bindable() }: Props = $props();

	socket.on('get_question_results', () => {
		console.log('get_question_results');
	});
	socket.on('set_question_number', (data) => {
		game_state.timer_res = '0';
		game_state.question_results = null;
		game_state.shown_question_now = data.question_index;
		game_state.timer_res = game_state.quiz_data.questions[data.question_index].time;
		game_state.selected_question = game_state.selected_question + 1;
		game_state.answer_count = 0;
		// Every advance comes through here, so this is where the scoreboard closes. The
		// Enter/Space shortcut used to skip it without closing it, and from then on every
		// question's answers were drawn as the scoreboard instead.
		game_state.scoreboard_open = false;

		clearInterval(timer_interval);
		timer(game_state.timer_res);
	});

	socket.on('solutions', (_) => {
		game_state.timer_res = '0';
		clearInterval(timer_interval);
	});

	socket.on('final_results', (data) => {
		final_results_clicked = true;
		game_state.timer_res = '0';
		// The podium reads player_scores. Rebuild it from the server's record rather
		// than trusting the per-question tally, which misses any question whose
		// results screen was skipped or left in under a second.
		game_state.player_scores = totalsFromResults(data, Object.keys(game_state.player_scores));
		game_state.final_results = data;
	});

	socket.on('everyone_answered', (_) => {
		game_state.timer_res = '0';
	});

	socket.on('question_results', (data) => {
		game_state.question_results = data;
		game_state.timer_res = '0';
	});

	socket.on('player_answer', (_) => {
		game_state.answer_count += 1;
	});

	const timer = (time: string) => {
		let seconds = Number(time);
		timer_interval = setInterval(() => {
			if (game_state.timer_res === '0') {
				clearInterval(timer_interval);
				return;
			} else {
				seconds--;
			}

			game_state.timer_res = seconds.toString();
		}, 1000);
	};

	const socket_game_controls: SocketGameControls = new SocketGameControls(socket);

	// One press per question, as in Kahoot (Gonçalo, 7 Oct). When the question ends --
	// time up, everyone answered, or Stop time -- its answers come up by themselves, and
	// the scoreboard three seconds after that. The host's press is "Next question". The
	// last question stops at its answers: no scoreboard, so the podium is not given away.
	// Slides and hide-results questions are left to the host, as before.
	const step = $derived(nextStep(stepState(game_state)));

	// Once per question, even if the step flickers back (a reconnect re-reporting the
	// question closed). A short grace after the clock hits zero, so an answer sent in the
	// last instant on a phone still lands before the question is closed on the server.
	let auto_results_for = -1;
	$effect(() => {
		if (step !== 'show_results') return;
		const question = game_state.selected_question;
		if (auto_results_for === question) return;
		const timeout = setTimeout(() => {
			auto_results_for = question;
			performStep('show_results', socket_game_controls, game_state, game_token);
		}, 800);
		return () => clearTimeout(timeout);
	});

	// Reduced motion keeps the delay: it is pacing, so the room can read the answers,
	// not an animation.
	$effect(() => {
		if (step !== 'scoreboard') return;
		const timeout = setTimeout(() => (game_state.scoreboard_open = true), 3000);
		return () => clearTimeout(timeout);
	});
</script>

{#if game_state.control_visible}
	<Controls {bg_color} {socket_game_controls} {game_token} bind:game_state />
{/if}
{#if game_state.timer_res !== '0' && game_state.selected_question >= 0}
	<!-- mt-12 matches the controls bar's h-12. It was mt-10 against an h-10 bar; the
	     bar is taller now and the rule was cutting across its bottom edge. -->
	<span
		class="bg-destructive/90 fixed top-0 left-0 h-1.5 w-full origin-left rounded-r-full transition-transform duration-1000 ease-linear"
		class:mt-12={game_state.control_visible}
		role="progressbar"
		aria-label="Time remaining"
		aria-valuemin="0"
		aria-valuemax={parseInt(game_state.quiz_data.questions[game_state.selected_question].time)}
		aria-valuenow={parseInt(game_state.timer_res)}
		style="transform: scaleX({parseInt(game_state.timer_res) /
			parseInt(game_state.quiz_data.questions[game_state.selected_question].time)})"
	></span>
{/if}

<div class="contents">
	{#if game_state.timer_res !== undefined && !final_results_clicked && !game_state.question_results}
		<!-- Question is shown -->
		{#if game_state.quiz_data.questions[game_state.selected_question].type === QuizQuestionType.SLIDE}
			{#await import('$lib/play/admin/slide.svelte')}
				<Spinner my_20={false} />
			{:then c}
				<c.default
					question={game_state.quiz_data.questions[game_state.selected_question]}
				/>
			{/await}
		{:else}
			<Question
				quiz_data={game_state.quiz_data}
				selected_question={game_state.selected_question}
				timer_res={game_state.timer_res}
				answer_count={game_state.answer_count}
				{default_colors}
			/>
		{/if}
	{/if}
	{#if game_state.timer_res === '0' && JSON.stringify(game_state.final_results) === JSON.stringify( [null] ) && game_state.quiz_data.questions[game_state.selected_question].type !== QuizQuestionType.SLIDE && game_state.question_results !== null && game_state.quiz_data.questions[game_state.selected_question]?.hide_results !== true}
		{#if game_state.question_results === undefined}
			{#if !final_results_clicked}
				<div class="w-full flex justify-center">
					<h1 class="text-3xl">{$t('admin_page.no_answers')}</h1>
				</div>
			{/if}
		{:else if game_state.quiz_data.questions[game_state.selected_question].type === QuizQuestionType.VOTING}
			{#await import('$lib/play/admin/voting_results.svelte')}
				<Spinner />
			{:then c}
				<c.default
					data={game_state.question_results}
					question={game_state.quiz_data.questions[game_state.selected_question]}
				/>
			{/await}
		{:else if game_state.scoreboard_open}
			{#await import('$lib/play/admin/scoreboard.svelte')}
				<Spinner />
			{:then c}
				<c.default data={game_state.player_scores} new_data={game_state.question_results} />
			{/await}
		{:else}
			{#await import('$lib/play/admin/results.svelte')}
				<Spinner />
			{:then c}
				<c.default
					bind:data={game_state.player_scores}
					question={game_state.quiz_data.questions[game_state.selected_question]}
					new_data={game_state.question_results}
				/>
			{/await}
		{/if}
	{/if}
	{#if game_state.selected_question === -1}
		<div class="fq-stage justify-center">
			<h1 class="text-7xl text-center">{@html sanitizeTitleHtml(game_state.quiz_data.title)}</h1>
			<p class="text-3xl pt-8 text-center">{game_state.quiz_data.description}</p>
			{#if game_state.quiz_data.cover_image}
				<div class="flex justify-center align-middle items-center">
					<div class="h-[30vh] m-auto w-auto mt-12">
						<img
							class="max-h-full max-w-full block"
							src="/api/v1/storage/download/{game_state.quiz_data.cover_image}"
							alt=""
						/>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
