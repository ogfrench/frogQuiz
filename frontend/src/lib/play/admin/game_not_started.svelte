<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	// import AudioPlayer from '$lib/play/audio_player.svelte';
	import ControllerCodeDisplay from '$lib/components/controller/code.svelte';
	import { getLocalization } from '$lib/i18n';
	import GrayButton from '$lib/components/buttons/gray.svelte';
	import { fade, fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { Button } from '$lib/components/ui/button';
	import { SocketGameControls } from '$lib/play/admin/socket_game_controls.ts';
	import type { GameState } from '$lib/play/admin/game_state';

	interface Props {
		game_pin: string;
		game_state: GameState;
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

<div class="flex min-h-[calc(100vh-3rem)] w-full flex-col items-center justify-center gap-10 px-6 py-10">
	<!-- The join details are the whole point of this screen, so they get the
	     centre and the largest type rather than being split across three
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
			<p
				class="select-all font-mono text-6xl font-bold leading-none tracking-[0.12em] tabular-nums md:text-8xl"
			>
				{game_pin}
			</p>
		</div>

		<button
			type="button"
			onclick={() => (fullscreen_open = true)}
			aria-label={$t('play_page.join_by_entering_code')}
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
			{#if game_state.players.length <= 1}
				{$t('play_page.players_waiting', { count: game_state.players.length ?? 0 })}
			{:else}
				{$t('play_page.players_waiting_plural', { count: game_state.players.length ?? 0 })}
			{/if}
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
								socket_game_controls.kick_player(player.username, game_state.players)}
							class="group rounded-full border border-border bg-card px-4 py-2 text-lg font-medium shadow-sm
								transition-all hover:border-destructive hover:text-destructive
								focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
								motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95"
							in:fly|global={{ y: 8, duration: 220 }}
						>
							<span class="group-hover:line-through">{player.username}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>

{#if fullscreen_open}
	<div
		class="fixed top-0 left-0 z-50 w-screen h-screen bg-black/50 flex p-2"
		transition:fade|global={{ duration: 80 }}
		onclick={() => (fullscreen_open = false)}
		tabindex="0"
		role="button"
		aria-label="Close modal"
		onkeydown={(e) =>
			e.key === 'Enter' || e.key === ' '
				? () => {
						fullscreen_open = false;
					}
				: null}
	>
		<img
			alt="QR code to join the game"
			src="/api/v1/utils/qr/{game_pin}"
			class="object-contain rounded-sm m-auto h-full bg-white"
		/>
	</div>
{/if}
