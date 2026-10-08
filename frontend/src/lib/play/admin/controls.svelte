<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { getLocalization } from '$lib/i18n';
	import ConfirmAction from '$lib/components/ConfirmAction.svelte';
	import Flag from '@lucide/svelte/icons/flag';
	import LockToggle from '$lib/play/admin/lock_toggle.svelte';
	import { SocketGameControls } from '$lib/play/admin/socket_game_controls.ts';
	import type { IGameState } from '$lib/play/admin/game_state.ts';
	import { isLastQuestion, nextStep, performStep, stepState } from '$lib/play/admin/next_step';

	interface Props {
		bg_color: string;
		socket_game_controls: SocketGameControls;
		game_token: string;
		game_state: IGameState;
	}

	let { bg_color, socket_game_controls, game_token, game_state = $bindable() }: Props = $props();

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
     browser put it. A flex row with space-between says what is meant. -->
<div
	class="fixed inset-x-0 top-0 z-20 flex h-12 items-center justify-between gap-3 px-3"
	style="background: {bg_color ? bg_color : 'transparent'}"
	class:text-black={bg_color}
>
	<!-- Question position is the most-referenced state on a projector screen, so
	     it gets a legible pill rather than 14px of body text in the corner. -->
	<div class="flex items-center gap-2">
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
				{$t('admin_page.end_game')}
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
	<div>
		<!-- The standings get their own step between the answers and the next question,
		     the way Kahoot sequences a round. It comes up by itself three seconds after the
		     answers (admin.svelte); this button is there to skip ahead. -->
		{#if step !== 'none'}
			<button
				onclick={() => performStep(step, socket_game_controls, game_state, game_token)}
				class="admin-button">{label}</button
			>
		{/if}
	</div>
</div>
