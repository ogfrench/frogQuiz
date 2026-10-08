<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getLocalization } from '$lib/i18n';
	import ConfirmAction from '$lib/components/ConfirmAction.svelte';
	import Flag from '@lucide/svelte/icons/flag';
	import LockToggle from '$lib/play/admin/lock_toggle.svelte';
	import ThemeToggle from '$lib/theme-toggle.svelte';
	import { SocketGameControls } from '$lib/play/admin/socket_game_controls.ts';
	import type { IGameState } from '$lib/play/admin/game_state.ts';
	import { isLastQuestion, nextStep, performStep, stepState } from '$lib/play/admin/next_step';

	interface Props {
		bg_color: string;
		socket_game_controls: SocketGameControls;
		game_token: string;
		game_state: IGameState;
		/** What the host can do once the podium is up: the page that owns them passes them in. */
		finish?: Snippet;
	}

	let {
		bg_color,
		socket_game_controls,
		game_token,
		game_state = $bindable(),
		finish
	}: Props = $props();

	const { t } = getLocalization();

	// The bar shows the one step the shortcut and the automatic flow would take, from
	// next_step.ts. It was a chain of conditions of its own, which had drifted from the
	// shortcut's: the last question offered a Scoreboard that gave the podium away.
	const step = $derived(nextStep(stepState(game_state)));
	const label = $derived.by(() => {
		switch (step) {
			case 'stop_time':
				return $t('admin_page.stop_time_and_solutions');
			case 'show_results':
				return $t('admin_page.show_results');
			case 'scoreboard':
				return $t('admin_page.show_scoreboard');
			case 'final_results':
				return $t('admin_page.get_final_results');
			case 'skip_results':
				return isLastQuestion({
					selected_question: game_state.selected_question,
					questions: game_state.quiz_data.questions
				})
					? $t('admin_page.get_final_results')
					: $t('admin_page.next_question', { question: game_state.selected_question + 2 });
			case 'next_question':
				return $t('admin_page.next_question', { question: game_state.selected_question + 2 });
			default:
				return '';
		}
	});
</script>

<!-- Was a two-column grid whose button cell asked for col-start-3, a column that
     does not exist, so the one control the host actually uses ended up wherever the
     browser put it. A flex row with space-between says what is meant. Inset from the
     edges like the lobby's corner controls: flush against the top it read as crammed
     on a projector (Gonçalo, 7 Oct). fq-stage keeps clear of it (--fq-stage-top). -->
<div
	class="fixed inset-x-3 top-3 z-20 flex min-h-12 items-center justify-between gap-2 rounded-2xl sm:gap-3"
	style="background: {bg_color ? bg_color : 'transparent'}"
	class:text-black={bg_color}
>
	<!-- Question position is the most-referenced state on a projector screen, so
	     it gets a legible pill rather than 14px of body text in the corner. -->
	<div class="flex min-w-0 items-center gap-2">
		<p
			class="rounded-full border border-border bg-card/80 px-3 py-1
				text-base font-semibold tabular-nums shadow-sm backdrop-blur"
			aria-live="polite"
		>
			<span class="sr-only">Question </span>{game_state.selected_question === -1
				? '0'
				: game_state.selected_question + 1}<span class="text-muted-foreground"
				>&nbsp;/&nbsp;{game_state.quiz_data.questions.length}</span
			>
		</p>
		<!-- Ending early is the final-results path the last question already takes, so
		     players get the podium for what they played rather than a dead screen. -->
		{#if JSON.stringify(game_state.final_results) === JSON.stringify([null])}
			<ConfirmAction
				title={$t('admin_page.end_confirm_title')}
				body={$t('admin_page.end_confirm_body')}
				confirmLabel={$t('admin_page.end_game')}
				cancelLabel={$t('admin_page.keep_playing')}
				onconfirm={() => socket_game_controls.get_final_results()}
				class="bg-card/80 backdrop-blur"
			>
				<Flag />
				<!-- Icon only on a phone, where the bar has no room for the word and the step
				     button; the confirm dialog still says what it does. -->
				<span class="max-sm:sr-only">{$t('admin_page.end_game')}</span>
			</ConfirmAction>
			<!-- Late joiners need the PIN once the lobby has gone, as Kahoot keeps it on screen. -->
			{#if !game_state.quiz_data.locked}
				<p
					class="rounded-full border border-border bg-card/80 px-3 py-1 text-base font-semibold
						tabular-nums shadow-sm backdrop-blur max-md:hidden"
				>
					<span class="text-muted-foreground">{$t('words.pin')}</span>
					{game_state.quiz_data.game_pin}
				</p>
			{/if}
			<LockToggle
				locked={game_state.quiz_data.locked}
				{socket_game_controls}
				compact
				class="bg-card/80 backdrop-blur"
			/>
		{/if}
	</div>
	<div class="flex items-center gap-2">
		<!-- The navbar is hidden in a game, and with it the only theme switch. -->
		<ThemeToggle class="bg-card/80 border-border border shadow-sm backdrop-blur" />
		<!-- The standings get their own step between the answers and the next question,
		     the way Kahoot sequences a round. It comes up by itself three seconds after the
		     answers (admin.svelte); this button is there to skip ahead. -->
		{#if step !== 'none'}
			<!-- "Stop time and show solutions" is the longest label. On a phone it takes two
			     short lines inside the bar; it used to wrap to three and hang below it. -->
			<button
				onclick={() => performStep(step, socket_game_controls, game_state, game_token)}
				class="admin-button text-balance max-sm:max-w-36 max-sm:px-3 max-sm:text-xs max-sm:leading-tight"
				>{label}</button
			>
		{/if}
		<!-- The podium's actions take the step button's place, so the last thing the host
		     presses is where the next thing has been all game. They were a second panel
		     under the bar, out of line with it, with both buttons squashed to 20px. -->
		{#if JSON.stringify(game_state.final_results) !== JSON.stringify([null])}
			{@render finish?.()}
		{/if}
	</div>
</div>
