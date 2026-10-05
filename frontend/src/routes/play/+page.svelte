<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<!--suppress ALL -->
<script lang="ts">
	import { socket } from '$lib/socket';
	import JoinGame from '$lib/play/join.svelte';
	import type { Question as QuestionType } from '$lib/quiz_types';
	import ShowTitle from '$lib/play/title.svelte';
	import Question from '$lib/play/question.svelte';
	import { navbarVisible } from '$lib/stores.svelte.ts';
	import ShowEndScreen from '$lib/play/admin/final_results.svelte';
	import KahootResults from '$lib/play/results_kahoot.svelte';
	import { getLocalization } from '$lib/i18n';
	import Cookies from 'js-cookie';
	import { Button } from '$lib/components/ui/button';
	import ConfirmAction from '$lib/components/ConfirmAction.svelte';
	import House from '@lucide/svelte/icons/house';
	import LogOut from '@lucide/svelte/icons/log-out';
	import { onMount } from 'svelte';
	import { totalsFromResults } from '$lib/play/admin/totals';
	const { t } = getLocalization();

	interface Props {
		// Exports
		data: any;
	}

	let { data }: Props = $props();
	let { game_pin } = $state(data);

	// Types
	interface GameMeta {
		started: boolean;
	}

	let game_mode = $state();
	let final_results: Array<null> | Array<Array<PlayerAnswer>> = $state([null]);

	interface PlayerAnswer {
		username: string;
		answer: string;
		right: string;
	}

	// Variables init
	let question_index = $state('');
	let unique = $state({});
	navbarVisible.visible = false;
	// Every player's answer to the question just closed, as the server sends it.
	let answer_results: Array<{
		username: string;
		answer: string;
		right: boolean;
		time_taken: number;
		score: number;
	}> = $state();
	let gameData = $state<{
		title: string;
		description: string;
		cover_image?: string;
		background_color?: string;
	}>();
	let solution: QuestionType = $state();
	let username = $state('');
	let scores = $state({});
	let gameMeta: GameMeta = $state({
		started: false
	});

	let question: QuestionType = $state();

	// Why the player is back on the join screen, if they were sent there.
	let join_error = $state('');
	// The host canceled the game from its lobby.
	let game_ended = $state(false);
	// The host's connection dropped and has not come back (E22 in docs/edge-cases-2026-10.md).
	let host_gone = $state(false);

	// Which game this tab is in, for a rejoin after a reload. Per tab first: two players in one
	// browser (two tabs) shared the cookie, so a reload in one took over the other's player
	// (E24). The cookie is the fallback that lets a new tab rejoin after the old one closed,
	// and only then: a tab in a game says so every few seconds, and a new tab that hears it
	// leaves that player alone instead of taking them over.
	const JOINED = 'joined_game';
	const ALIVE = 'joined_game_alive';
	const ALIVE_EVERY_MS = 3000;
	let alive_timer: ReturnType<typeof setInterval> | undefined;
	const sayAlive = () => localStorage.setItem(ALIVE, String(Date.now()));
	const stopAlive = () => {
		clearInterval(alive_timer);
		alive_timer = undefined;
		localStorage.removeItem(ALIVE);
	};
	const readJoined = () => {
		const own = sessionStorage.getItem(JOINED);
		if (own) return own;
		const heard = Number(localStorage.getItem(ALIVE) ?? 0);
		return Date.now() - heard > ALIVE_EVERY_MS * 3 ? Cookies.get(JOINED) : undefined;
	};
	const forgetJoined = () => {
		stopAlive();
		sessionStorage.removeItem(JOINED);
		Cookies.remove(JOINED);
	};

	// Back to an empty join screen without a reload, so a reason can be shown there.
	const reset_to_join = (reason = '') => {
		forgetJoined();
		gameData = undefined;
		gameMeta.started = false;
		question_index = '';
		answer_results = undefined;
		final_results = [null];
		game_pin = '';
		join_error = reason;
	};

	let preventReload = true;
	// The joined_game cookie's contents while a rejoin is in flight.
	let rejoining: { sid: string; username: string; game_pin: string } | undefined;

	// Functions
	function restart() {
		unique = {};
	}

	const confirmUnload = (event: Event) => {
		// Only warn once the player has actually joined a game. Previously this was
		// armed from page load, so the browser prompted "Changes you made may not be
		// saved" on every navigation away from an untouched join screen.
		if (preventReload && game_pin !== '' && username !== '') {
			event.preventDefault();
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			event.returnValue = '';
		}
	};

	// The socket is a module and outlives this page, because the app navigates without
	// unloading. A back swipe mid-game left the player connected and counted with no screen
	// to answer on, and coming forward showed an empty join form with their own nickname
	// taken (E6 in docs/edge-cases-2026-10.md). Leaving now drops the connection, as
	// closing the tab does; coming back connects again and the handler below rejoins.
	// The listeners below are registered when the page is created and go with it: left on
	// the socket, coming back stacked a second set on top of the first.
	onMount(() => {
		if (!socket.connected) socket.connect();
		return () => {
			if (alive_timer) stopAlive();
			socket.off();
			socket.disconnect();
		};
	});

	socket.on('time_sync', (data) => {
		socket.emit('echo_time_sync', data);
	});

	socket.on('connect', async () => {
		console.log('Connected!');
		const joined_data = readJoined();
		if (!joined_data) {
			return;
		}
		const data = JSON.parse(joined_data);
		rejoining = data;
		socket.emit('rejoin_game', {
			old_sid: data.sid,
			username: data.username,
			game_pin: data.game_pin
		});
		const res = await fetch(`/api/v1/quiz/play/check_captcha/${data.game_pin}`);
		const json = await res.json();
		game_mode = json.game_mode;
	});

	// js-cookie's `expires` is in days; this was 3600, about ten years. A game lives
	// in Redis for five hours, so there is nothing to rejoin after that.
	const JOINED_GAME_COOKIE_DAYS = 5 / 24;
	const rememberJoinedGame = () => {
		const joined_data = JSON.stringify({ sid: socket.id, username, game_pin });
		sessionStorage.setItem(JOINED, joined_data);
		Cookies.set(JOINED, joined_data, { expires: JOINED_GAME_COOKIE_DAYS });
		sayAlive();
		alive_timer ??= setInterval(sayAlive, ALIVE_EVERY_MS);
	};

	// Socket-events
	socket.on('joined_game', (data) => {
		gameData = data;
		// A late joiner arrives in a game that has started; the question that is up, if
		// any, follows straight after.
		if (data.started) gameMeta.started = true;
		rememberJoinedGame();
	});
	socket.on('rejoined_game', (data) => {
		// A reload starts with the nickname and PIN empty. Restore them only now the
		// server has taken us back -- set earlier, the join form would look the PIN up
		// itself and alert "Game not found" on top of our own handling of a dead game.
		if (rejoining) {
			username = rejoining.username;
			game_pin = rejoining.game_pin;
		}
		gameData = data;
		// The server has moved this player to the new socket id. Without this the
		// cookie keeps the first one, and a second reload is refused.
		rememberJoinedGame();
		if (data.started) {
			gameMeta.started = true;
		}
	});

	socket.on('game_not_found', () => {
		if (readJoined()) {
			forgetJoined();
			window.location.reload();
			return;
		}
	});

	socket.on('set_question_number', (data) => {
		solution = undefined;
		restart();
		question = data.question;
		question_index = data.question_index;
		answer_results = undefined;
	});

	socket.on('start_game', () => {
		gameMeta.started = true;
	});

	socket.on('question_results', (data) => {
		restart();
		answer_results = data;
	});

	socket.on('kick', () => {
		// The PIN, not a bare flag: it only refuses this game. See join.svelte.
		Cookies.set('kicked', game_pin, { expires: 1 });
		reset_to_join($t('play_page.kicked'));
	});
	socket.on('game_ended', () => {
		forgetJoined();
		game_ended = true;
	});
	socket.on('left_game', () => {
		reset_to_join();
	});
	socket.on('final_results', (data) => {
		final_results = data;
		// The podium reads `scores`, which this page added up question by question, so a phone
		// that reloaded mid-game (or slept through the end) showed totals from after the
		// reload only. The server's record has every answer (E18).
		scores = totalsFromResults(data, Object.keys(scores));
		forgetJoined();
	});
	socket.on('host_left', () => {
		host_gone = true;
	});
	socket.on('host_back', () => {
		host_gone = false;
	});

	socket.on('solutions', (data) => {
		solution = data;
	});

	let bg_color = $derived(gameData ? gameData.background_color : undefined);

	const show_final = $derived(JSON.stringify(final_results) !== JSON.stringify([null]));
	const joined = $derived(gameData !== undefined);
	// A live question fills the screen with answer tiles; a corner button there would sit
	// on them and invite a mis-tap mid-answer. Leaving waits for the lobby or results.
	const in_question = $derived(
		gameMeta.started && question_index !== '' && answer_results === undefined
	);

	// The rest
</script>

<svelte:window onbeforeunload={confirmUnload} onpagehide={() => alive_timer && stopAlive()} />
<svelte:head>
	<title>frogQuiz - Play</title>
</svelte:head>
<div
	class="min-h-dvh w-full"
	style="background: {bg_color ? bg_color : 'transparent'}"
	class:text-black={bg_color}
>
	<!-- The navbar is hidden here, so this is the only way out. /play used to be a PIN box
	     and a Submit button with nowhere else to go. -->
	{#if !joined || show_final || game_ended}
		<div class="fixed top-3 left-3 z-30">
			<Button href="/" variant="ghost" size="sm">
				<House />
				{$t('play_page.home')}
			</Button>
		</div>
	{:else if !in_question}
		<div class="fixed top-3 left-3 z-30">
			<ConfirmAction
				title={$t('play_page.leave_confirm_title')}
				body={$t('play_page.leave_confirm_body')}
				confirmLabel={$t('play_page.leave_game')}
				cancelLabel={$t('words.cancel')}
				onconfirm={() => socket.emit('leave_game', {})}
			>
				<LogOut />
				{$t('play_page.leave_game')}
			</ConfirmAction>
		</div>
	{/if}
	{#if host_gone && joined && !show_final && !game_ended}
		<p
			role="status"
			class="border-border bg-card text-foreground fixed inset-x-4 bottom-4 z-30 mx-auto max-w-sm rounded-lg border p-3 text-center text-sm shadow-sm"
		>
			{$t('play_page.host_left')}
		</p>
	{/if}
	<div>
		{#if game_ended}
			<div class="fq-stage text-center">
				<div class="flex flex-col items-center gap-2">
					<h1 class="text-3xl font-semibold tracking-tight text-balance">
						{$t('play_page.game_ended_title')}
					</h1>
					<p class="text-muted-foreground">{$t('play_page.game_ended_body')}</p>
				</div>
				<Button
					size="lg"
					onclick={() => {
						game_ended = false;
						reset_to_join();
					}}
				>
					{$t('play_page.join_another')}
				</Button>
			</div>
		{:else if !gameMeta.started && gameData === undefined}
			<JoinGame bind:game_pin bind:game_mode bind:username bind:error_message={join_error} />
		{:else if show_final}
			<ShowEndScreen bind:data={scores} show_final_results={true} {username} />
		{:else if gameData !== undefined && question_index === ''}
			<ShowTitle
				title={gameData.title}
				description={gameData.description}
				cover_image={gameData.cover_image}
				{username}
			/>
		{:else if gameMeta.started && gameData !== undefined && question_index !== '' && answer_results === undefined}
			{#key unique}
				<!-- This wrapper forced black text on the whole question screen, which made the
				     post-answer and time-up states unreadable in dark mode. The answer tiles set
				     their own ink inline from the tile color, so they never needed it. -->
				<div>
					<Question bind:game_mode bind:question {question_index} {solution} />
				</div>
			{/key}
		{:else if gameMeta.started && answer_results !== undefined}
			<!-- Both of these were bare divs with no stage, so the heading sat flush
			     against the top edge of the phone with the bottom half of the screen
			     empty. fq-stage (and not a second one nested inside: the wrapper above
			     is a plain min-h-dvh block, exactly as it is for the join and title
			     screens which already render their own stage here) gives them the same
			     vertical rhythm and centering as every other game surface. Its
			     section gap replaces the heading's own mb-8. -->
			{#if answer_results === null}
				<div class="fq-stage">
					<h1 class="text-center text-3xl text-balance">{$t('admin_page.no_answers')}</h1>
				</div>
			{:else}
				<div class="fq-stage">
					<h1 class="text-center text-3xl">{$t('words.result', { count: 2 })}</h1>
					{#key unique}
						<KahootResults {username} question_results={answer_results} bind:scores />
					{/key}
				</div>
			{/if}
		{/if}
	</div>
</div>
