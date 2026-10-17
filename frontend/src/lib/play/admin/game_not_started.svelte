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
	import { onDestroy, onMount } from 'svelte';
	import { FROGS } from '$lib/play/avatars.svelte';
	import Wordmark from '$lib/components/Wordmark.svelte';
	import { ownsKey } from '$lib/play/admin/shortcut';

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

	// A click on a chip removes the player at once, as on Kahoot, with a few seconds to
	// take it back (François, 17 Oct): one slip on a projector clicker used to throw a
	// colleague out. The server holds the removal for the window (remove_player) and ends
	// it itself, so a host who closes the tab inside it no longer drops it, and someone
	// else asking for the name ends it at once instead of being told the name is taken.
	// Until then the player is hidden, not taken out of the list: the list is the server's,
	// and a rejoin, a leave or a host reconnect inside the window changes it, which a
	// local splice and re-insert duplicated or brought back as a ghost.
	//
	// Quick removals stack (François, 17 Oct): a removed chip lets the next one slide under
	// the pointer, so a double click removed two people and Undo brought back only the
	// second. Every removal in a burst waits on the last click, and Undo restores them all.
	const UNDO_MS = 5000;
	let pending: string[] = $state([]);
	let pending_timer: ReturnType<typeof setTimeout> | undefined;
	const still_here = (username: string) =>
		game_state.players.some((p) => p.username === username);
	const waiting = $derived(game_state.players.filter((p) => !pending.includes(p.username)));
	// The ones the toast speaks for: a player who left meanwhile has nothing to undo.
	const removed = $derived(pending.filter(still_here));
	const drop = (names: string[]) => {
		game_state.players = game_state.players.filter((p) => !names.includes(p.username));
	};
	// The Undo ran out. The server's waits end a second later and say so with
	// player_removed, which the admin page applies as well.
	const expire = () => {
		const names = pending;
		pending = [];
		drop(names);
	};
	// Now rather than when the waits end: Start, or leaving the lobby.
	const send_pending = () => {
		clearTimeout(pending_timer);
		const names = pending;
		pending = [];
		for (const name of names) socket_game_controls.kick_player(name);
		drop(names);
	};
	const remove = (username: string) => {
		if (pending.includes(username)) return;
		pending = [...pending, username];
		// Asked again for the earlier ones too, so the server's waits restart from this click
		// as the toast's does; a newer request replaces an older one (remove_player).
		for (const name of pending) socket_game_controls.remove_player(name);
		clearTimeout(pending_timer);
		pending_timer = setTimeout(expire, UNDO_MS);
	};
	const undo = () => {
		clearTimeout(pending_timer);
		for (const name of pending) socket_game_controls.undo_remove_player(name);
		pending = [];
	};
	// The server ended one wait early because someone else asked for that name. Cleared in
	// the same event, before that person's join arrives and is hidden as the old player.
	const on_removed = (data: { username: string }) => {
		if (!pending.includes(data.username)) return;
		pending = pending.filter((name) => name !== data.username);
		if (pending.length === 0) clearTimeout(pending_timer);
	};
	onMount(() => {
		socket_game_controls.socket.on('player_removed', on_removed);
		return () => socket_game_controls.socket.off('player_removed', on_removed);
	});
	onDestroy(send_pending);

	// A projector never scrolls (12 Oct). The names stop where the screen does: chips that
	// do not fit are hidden and a pill says how many more. Once that happens the newest
	// come first, since the person who just joined is the one looking for their name, and
	// the order stays newest-first until everyone fits again and the lobby is smaller than
	// when it first overflowed, so it cannot flip back and forth on one chip's width.
	let board: HTMLUListElement | undefined = $state();
	let hidden = $state(0);
	let newest_first_from: number | null = $state(null);
	const shown_players = $derived(newest_first_from !== null ? [...waiting].reverse() : waiting);

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
		const count = waiting.length;
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

	const start = () => {
		if (waiting.length < 1) return;
		// A removal still waiting on its Undo goes first, so that player is not in the game.
		send_pending();
		socket_game_controls.start_game();
	};
	// Space and Enter start the game, as they take the next step all game (admin page).
	const on_key = (e: KeyboardEvent) => {
		if (e.key !== ' ' && e.key !== 'Enter') return;
		if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || ownsKey(e.target))
			return;
		e.preventDefault();
		start();
	};

	const join_url =
		window.location.host === 'frogquiz.xyz'
			? 'frogquiz.xyz/play'
			: `${window.location.host}/play`;
</script>

<svelte:window onkeydown={on_key} />

<!-- The game's own bar (controls.svelte), so the host learns one place: the way out and
     Lock on the left, the one thing to press on the right, where Next and Stop time are
     all game (François, 17 Oct). The lobby used to have no way out but closing the tab,
     which left the PIN live and the joined players waiting on a game that never started. -->
<div class="fixed inset-x-3 top-3 z-30 flex min-h-12 items-center justify-between gap-2 sm:gap-3">
	<div class="flex min-w-0 items-center gap-2">
		<ConfirmAction
			title={$t('admin_page.cancel_confirm_title')}
			body={$t('admin_page.cancel_confirm_body')}
			confirmLabel={$t('admin_page.cancel_game')}
			cancelLabel={$t('admin_page.keep_waiting')}
			onconfirm={() => socket_game_controls.end_game()}
			class="bg-card/80 backdrop-blur"
		>
			<X />
			<span class="max-sm:sr-only">{$t('admin_page.cancel_game')}</span>
		</ConfirmAction>
		<LockToggle
			locked={game_state.quiz_data?.locked}
			{socket_game_controls}
			compact
			class="bg-card/80 backdrop-blur"
		/>
	</div>
	<div class="flex items-center gap-2">
		<!-- The navbar is hidden in a game, and with it the only theme switch. -->
		<ThemeToggle class="bg-card/80 border-border border shadow-sm backdrop-blur" />
		<!-- The shadcn Button, not the game bar's admin-button: a Start with nobody to start
		     takes the app's one disabled look (the pale chip), not a half-faded black. -->
		<Button
			aria-keyshortcuts="Space Enter"
			disabled={waiting.length < 1}
			onclick={start}
			class="gap-2 max-sm:px-3 sm:h-11 sm:px-5 sm:text-base"
			>{$t('admin_page.start_game')}<kbd
				aria-hidden="true"
				class="border-primary-foreground/30 hidden rounded-sm border px-1.5 py-0.5 font-sans text-xs font-medium md:inline pointer-coarse:hidden"
				>Space</kbd
			></Button
		>
	</div>
</div>

<!-- The lobby is the one screen with nothing to do on it: people are walking in and
     reading a PIN off a wall. Music belongs here and nowhere else, and it stops when the
     component goes, which is the moment the first question appears. -->
<LobbyMusic />

<h1 class="sr-only">{$t('admin_page.lobby_title')}</h1>

<!-- How to join across the top, the room under it (François, 17 Oct). One composition
     from the first player to the last: the empty state sits where the names will be.
     h-dvh, not a min-height: the names shrink to what is left of the screen instead of
     making the page taller, because a projector never scrolls. -->
<div
	class="flex h-dvh flex-col items-center gap-4 px-4 pt-18 pb-16 sm:px-6 md:gap-6 md:pt-20 lg:px-12"
>
	<section
		class="border-border bg-card/85 grid w-full max-w-6xl shrink-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-2xl border p-3 shadow-xl shadow-zinc-900/5 backdrop-blur-sm sm:gap-8 md:gap-12 md:rounded-3xl md:p-5 md:pr-12"
	>
		<!-- bg-white and the padding, here and in the full-screen code below, are deliberate
		     and must not become tokens: the code image runs to its own edge, and a QR code
		     needs a light quiet zone around it to scan, in either theme. -->
		<button
			type="button"
			onclick={() => (fullscreen_open = true)}
			aria-label={$t('play_page.show_qr_full_screen')}
			class="focus-visible:ring-ring block size-[min(30dvh,8rem)] shrink-0 rounded-xl bg-white p-[3.5%] transition-transform hover:scale-[1.01] focus-visible:ring-4 focus-visible:outline-none sm:size-[min(30dvh,21rem)]"
		>
			<img
				alt="QR code to join the game"
				src="/api/v1/utils/qr/{game_pin}"
				class="size-full"
			/>
		</button>
		<div class="flex min-w-0 flex-col items-start gap-1 sm:gap-3">
			<Wordmark size={30} class="text-2xl max-md:hidden" />
			<!-- The one line a latecomer needs, read from the back of the room. -->
			<p class="text-muted-foreground text-[clamp(1rem,2vw,2rem)] leading-snug">
				{$t('admin_page.lobby_go_to')}
				<span class="text-foreground font-semibold wrap-anywhere">{join_url}</span><br />
				{$t('admin_page.lobby_and_enter')}
			</p>
			<!-- Two groups of three read faster from across a room; the gap is spacing, not
			     a character, so a copied PIN is still six digits. -->
			<p
				class="text-[clamp(2.5rem,min(9vw,13dvh),9rem)] leading-none font-bold tracking-[0.03em] tabular-nums select-all"
			>
				<span>{game_pin.slice(0, 3)}</span><span class="ml-[0.28em]"
					>{game_pin.slice(3)}</span
				>
			</p>
		</div>
	</section>

	{#if cqc_code}
		<div class="flex shrink-0 flex-col items-center gap-2">
			<p class="text-muted-foreground">{$t('play_page.join_by_entering_code')}</p>
			<ControllerCodeDisplay code={cqc_code} />
		</div>
	{/if}

	<section class="flex min-h-0 w-full max-w-6xl flex-auto flex-col gap-3 md:gap-4">
		<p
			class="shrink-0 text-[clamp(1.125rem,2vw,1.75rem)] font-semibold tracking-tight"
			aria-live="polite"
		>
			<!-- i18next picks _one / _other from the count; the old _plural suffix was
			     i18next v20's and printed the raw key on the projector. -->
			{waiting.length
				? $t('play_page.players_waiting', { count: waiting.length })
				: $t('admin_page.lobby_title')}
		</p>
		{#if waiting.length > 0}
			<ul
				bind:this={board}
				class="relative flex min-h-[4.5rem] w-full flex-auto flex-wrap content-start items-center gap-2.5 overflow-hidden p-1 md:gap-3"
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
							onclick={() => remove(player.username)}
							class="group border-border bg-card hover:border-destructive hover:text-destructive focus-visible:ring-ring motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 flex items-center gap-2.5 rounded-full border py-1.5 pr-4 pl-1.5 text-lg font-medium shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none lg:gap-3 lg:pr-5 lg:text-xl"
							in:fly|global={{ y: 8, duration: 220 }}
						>
							<!-- The frog is what a player looks for on the projector to see they are
							     in; the name confirms it. The name wraps inside the pill rather than
							     stretching it past the screen. -->
							<FrogAvatar name={player.username} class="size-9 lg:size-12" />
							<span class="block max-w-[18ch] wrap-anywhere group-hover:line-through"
								>{player.username}</span
							>
						</button>
					</li>
				{/each}
			</ul>
			{#if hidden > 0}
				<p
					class="border-border bg-card shrink-0 self-center rounded-full border px-4 py-1.5 text-lg font-semibold whitespace-nowrap shadow-sm"
				>
					{$t('admin_page.more_players', { count: hidden })}
				</p>
			{/if}
		{:else}
			<div class="flex flex-auto flex-col items-center justify-center gap-5 text-center">
				<!-- Three of the game's own frogs, as a promise of what fills this space. -->
				<div class="flex -space-x-5" aria-hidden="true">
					{#each [FROGS[3], FROGS[11], FROGS[20]] as src, i (i)}
						<span
							class="bg-muted ring-background size-16 overflow-hidden rounded-full ring-4 md:size-20 {i ===
							1
								? '-translate-y-2'
								: ''}"
							><img {src} alt="" class="size-full object-contain p-[9%]" /></span
						>
					{/each}
				</div>
				<p class="text-muted-foreground fq-meta max-w-[26ch] text-balance">
					{$t('admin_page.lobby_empty_hint')}
				</p>
			</div>
		{/if}
	</section>
</div>

<!-- Said where the host is looking, with the way back: always in the page, so a screen
     reader hears it when a name goes. -->
<div
	role="status"
	class="pointer-events-none fixed inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] z-50 flex justify-center px-4"
>
	{#if removed.length > 0}
		<!-- The chips' own card and border, not an inverted black pill: it sits under the
		     names on a light projector and shouted over them (François, 17 Oct). -->
		<p
			class="border-border bg-card text-foreground pointer-events-auto flex items-center gap-2 rounded-full border py-1.5 pr-1.5 pl-5 text-base shadow-md"
		>
			{removed.length === 1
				? $t('admin_page.removed_player', { name: removed[0] })
				: $t('admin_page.removed_players', { count: removed.length })}
			<Button size="sm" variant="ghost" class="rounded-full font-semibold" onclick={undo}>
				{$t('words.undo')}
			</Button>
		</p>
	{/if}
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
			<img alt="" src="/api/v1/utils/qr/{game_pin}" class="size-full object-contain" />
		</Dialog.Close>
	</Dialog.Content>
</Dialog.Root>
