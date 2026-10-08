<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import LobbyMusic from '$lib/play/lobby_music.svelte';
	import ControllerCodeDisplay from '$lib/components/controller/code.svelte';
	import { getLocalization } from '$lib/i18n';
	import { fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import ConfirmAction from '$lib/components/ConfirmAction.svelte';
	import X from '@lucide/svelte/icons/x';
	import LockToggle from '$lib/play/admin/lock_toggle.svelte';
	import ThemeToggle from '$lib/theme-toggle.svelte';
	import { SocketGameControls } from '$lib/play/admin/socket_game_controls.ts';
	import type { IGameState } from '$lib/play/admin/game_state';

	interface Props {
		game_pin: string;
		game_state: IGameState;
		socket_game_controls: SocketGameControls;
		cqc_code: string;
	}

	let {
		game_pin,
		game_state = $bindable(),
		socket_game_controls,
		cqc_code = $bindable()
	}: Props = $props();

	let fullscreen_open = $state(false);
	const { t } = getLocalization();

	if (cqc_code === 'null') {
		cqc_code = null;
	}
</script>

<!-- The lobby used to have no way out but closing the tab, which left the PIN live and
     the joined players waiting on a game that would never start. -->
<div class="fixed top-3 left-3 z-30">
	<ConfirmAction
		title={$t('admin_page.cancel_confirm_title')}
		body={$t('admin_page.cancel_confirm_body')}
		confirmLabel={$t('admin_page.cancel_game')}
		cancelLabel={$t('admin_page.keep_waiting')}
		onconfirm={() => socket_game_controls.end_game()}
	>
		<X />
		{$t('admin_page.cancel_game')}
	</ConfirmAction>
</div>
<!-- The navbar is hidden in a game, and with it the only theme switch. -->
<div class="fixed top-3 right-3 z-30 flex items-center gap-2">
	<ThemeToggle class="bg-card/80 border-border border shadow-sm backdrop-blur" />
	<LockToggle locked={game_state.quiz_data?.locked} {socket_game_controls} />
</div>

<!-- The lobby is the one screen with nothing to do on it: people are walking in and
     reading a PIN off a wall. Music belongs here and nowhere else, and it stops when the
     component goes, which is the moment the first question appears. -->
<LobbyMusic />

<h1 class="sr-only">{$t('admin_page.lobby_title')}</h1>

<div class="fq-stage">
	<!-- The join details are the whole point of this screen, so they get the
	     center and the largest type rather than being split across three
	     unaligned columns. -->
	<div class="flex flex-col items-center gap-8 md:flex-row md:items-center md:gap-12">
		<div class="flex flex-col items-center gap-3 md:items-start">
			<p class="text-lg text-muted-foreground md:text-xl">
				{$t('play_page.join_description', {
					url:
						window.location.host === 'frogquiz.xyz'
							? 'frogquiz.xyz/play'
							: `${window.location.host}/play`,
					pin: game_pin
				})}
			</p>
			<p class="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
				{$t('words.pin')}
			</p>
			<p class="fq-pin select-all font-mono font-bold tracking-[0.12em] tabular-nums">
				{game_pin}
			</p>
		</div>

		<button
			type="button"
			onclick={() => (fullscreen_open = true)}
			aria-label={$t('play_page.show_qr_full_screen')}
			class="rounded-2xl bg-white p-3 shadow-xl ring-1 ring-black/5 transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
		>
			<img
				alt="QR code to join the game"
				src="/api/v1/utils/qr/{game_pin}"
				class="size-40 md:size-56"
			/>
		</button>
	</div>

	{#if cqc_code}
		<div class="flex flex-col items-center gap-2">
			<p class="text-muted-foreground">{$t('play_page.join_by_entering_code')}</p>
			<ControllerCodeDisplay code={cqc_code} />
		</div>
	{/if}

	<Button
		size="lg"
		class="h-14 rounded-xl px-10 text-lg font-semibold shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:scale-100"
		disabled={game_state.players.length < 1}
		onclick={() => socket_game_controls.start_game()}
	>
		{$t('admin_page.start_game')}
	</Button>

	<div class="flex w-full max-w-5xl flex-col items-center gap-4">
		<p class="text-xl text-muted-foreground" aria-live="polite">
			<!-- i18next picks _one / _other from the count; the old _plural suffix was
			     i18next v20's and printed the raw key on the projector. -->
			{$t('play_page.players_waiting', { count: game_state.players.length ?? 0 })}
		</p>

		{#if game_state.players.length > 0}
			<ul class="flex flex-wrap items-center justify-center gap-2.5">
				{#each game_state.players as player (player.username)}
					<li animate:flip={{ duration: 250 }}>
						<button
							type="button"
							title={$t('words.kick')}
							aria-label="{$t('words.kick')}: {player.username}"
							onclick={() =>
								socket_game_controls.kick_player(
									player.username,
									game_state.players
								)}
							class="group rounded-full border border-border bg-card px-4 py-2 text-lg font-medium shadow-sm
								transition-all hover:border-destructive hover:text-destructive
								focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
								motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95"
							in:fly|global={{ y: 8, duration: 220 }}
						>
							<!-- Wraps inside the pill rather than stretching it past the projector: the
						     list is flex-wrap, so a chip that is wider than the screen overflows
						     the page instead of going to the next line. -->
							<span class="block max-w-[20ch] wrap-anywhere group-hover:line-through"
								>{player.username}</span
							>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>

<!-- The shadcn Dialog: Escape, a click anywhere, or Enter on the focused code closes it.
     It was a div with role="button" whose Enter/Space handler returned a function
     instead of calling it, and with no Escape at all, so from the keyboard it could be
     opened on the projector and never closed. Before that it was `w-screen h-screen`,
     which overflowed by the scrollbar width. -->
<Dialog.Root bind:open={fullscreen_open}>
	<Dialog.Content
		showCloseButton={false}
		class="grid h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-none place-items-center bg-transparent p-0 ring-0 sm:max-w-none"
	>
		<Dialog.Title class="sr-only">{$t('play_page.qr_code_title')}</Dialog.Title>
		<Dialog.Close
			aria-label={$t('words.close')}
			class="focus-visible:ring-ring aspect-square w-[min(100%,calc(100dvh-1rem))] rounded-2xl bg-white p-[4%] outline-none focus-visible:ring-4"
		>
			<!-- bg-white and the padding, here and on the thumbnail above, are deliberate and
			     must not become tokens: the code image runs to its own edge, and a QR code
			     needs a light quiet zone around it to scan, in either theme. -->
			<img alt="" src="/api/v1/utils/qr/{game_pin}" class="size-full object-contain" />
		</Dialog.Close>
	</Dialog.Content>
</Dialog.Root>
