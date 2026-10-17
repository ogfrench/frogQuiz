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
	import FrogAvatar from '$lib/components/FrogAvatar.svelte';
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

	// A projector never scrolls (12 Oct). The names stop where the screen does: chips that
	// do not fit are hidden and a pill says how many more. Once that happens the newest
	// come first, since the person who just joined is the one looking for their name, and
	// the order stays newest-first until everyone fits again and the lobby is smaller than
	// when it first overflowed, so it cannot flip back and forth on one chip's width.
	let board: HTMLUListElement | undefined = $state();
	let hidden = $state(0);
	let newest_first_from: number | null = $state(null);
	const shown_players = $derived(
		newest_first_from !== null ? [...game_state.players].reverse() : game_state.players
	);

	function fit() {
		if (!board) return;
		const items = [...board.children] as HTMLElement[];
		// The "+N more" pill sits below the board in the flow, so the board shrinks to make
		// room for it and the observer refits. Never hide the first chip: the board's minimum
		// height is one row, and a cramped screen still shows somebody.
		const first = items[0] ? items[0].offsetTop + items[0].offsetHeight : 0;
		const limit = Math.max(board.clientHeight, first);
		let off = 0;
		for (const li of items) {
			const out = li.offsetTop + li.offsetHeight > limit;
			if (out) off++;
			// Only what changed: 120 style writes on every refit restyled the whole board.
			const visibility = out ? 'hidden' : '';
			if (li.style.visibility !== visibility) li.style.visibility = visibility;
		}
		hidden = off;
		const count = game_state.players.length;
		if (hidden > 0 && newest_first_from === null) newest_first_from = count;
		if (newest_first_from !== null && hidden === 0 && count < newest_first_from)
			newest_first_from = null;
	}

	// The board and every chip are watched. A chip can change width while the board keeps
	// its size (Inter swapping in for the fallback face once it loads), which rewraps the
	// rows; watching only the board left the last row clipped and the count stale (#73).
	// Changing visibility resizes nothing, so fit() cannot feed itself.
	const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(fit);
	function watched(li: HTMLElement) {
		observer?.observe(li);
		return { destroy: () => observer?.unobserve(li) };
	}

	$effect(() => {
		void shown_players;
		fit();
	});
	$effect(() => {
		const el = board;
		if (!el) return;
		observer?.observe(el);
		return () => observer?.unobserve(el);
	});
	$effect(() => () => observer?.disconnect());

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

<!-- h-dvh, not the stage's usual min-height: the names below shrink to what is left of
     the screen instead of making the page taller. Safe centering: on a screen too short
     even for the PIN, Start and the count, the overflow goes below, where the page can
     scroll to it, instead of half above the top where nothing can. -->
<div class="fq-stage h-dvh [justify-content:safe_center]">
	<!-- The join details are the whole point of this screen, so they get the
	     center and the largest type rather than being split across three
	     unaligned columns. -->
	<div class="flex flex-col items-center gap-8 md:flex-row md:items-center md:gap-12">
		<div class="flex flex-col items-center gap-3 md:items-start">
			<!-- The one line a latecomer needs, read from the back of the room: it was the
			     smallest, greyest text on the screen (V1 game-screen review). -->
			<p class="fq-meta text-foreground">
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
			class="rounded-2xl bg-white p-3 transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
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

	<div class="relative flex min-h-0 w-full max-w-5xl flex-col items-center gap-4">
		<p class="shrink-0 text-xl text-muted-foreground" aria-live="polite">
			<!-- i18next picks _one / _other from the count; the old _plural suffix was
			     i18next v20's and printed the raw key on the projector. -->
			{$t('play_page.players_waiting', { count: game_state.players.length ?? 0 })}
		</p>

		{#if game_state.players.length > 0}
			<ul
				bind:this={board}
				class="relative flex min-h-[4.5rem] w-full flex-auto flex-wrap content-start items-center justify-center gap-2.5 overflow-hidden p-1"
			>
				{#each shown_players as player (player.username)}
					<!-- Newest first, every join moves every chip one place; sliding them all at
					     once overlapped half the board while a room was joining. -->
					<li
						use:watched
						animate:flip={{ duration: newest_first_from !== null ? 0 : 250 }}
					>
						<button
							type="button"
							title={$t('words.kick')}
							aria-label="{$t('words.kick')}: {player.username}"
							onclick={() =>
								socket_game_controls.kick_player(
									player.username,
									game_state.players
								)}
							class="group flex items-center gap-2.5 rounded-full border border-border bg-card py-1.5 pr-4 pl-1.5 text-lg font-medium shadow-sm
								transition-colors hover:border-destructive hover:text-destructive
								focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
								motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95"
							in:fly|global={{ y: 8, duration: 220 }}
						>
							<!-- Wraps inside the pill rather than stretching it past the projector: the
						     list is flex-wrap, so a chip that is wider than the screen overflows
						     the page instead of going to the next line. -->
							<!-- The frog is what a player looks for on the projector to see they are
							     in; the name confirms it. -->
							<FrogAvatar name={player.username} class="size-9 lg:size-12" />
							<span class="block max-w-[20ch] wrap-anywhere group-hover:line-through"
								>{player.username}</span
							>
						</button>
					</li>
				{/each}
			</ul>
			{#if hidden > 0}
				<p
					class="shrink-0 rounded-full border border-border bg-card px-4 py-1.5 text-lg font-semibold whitespace-nowrap shadow-sm"
				>
					{$t('admin_page.more_players', { count: hidden })}
				</p>
			{/if}
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
