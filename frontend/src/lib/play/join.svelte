<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { socket } from '$lib/socket';
	import { onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { getLocalization } from '$lib/i18n';
	import Cookies from 'js-cookie';
	import Wordmark from '$lib/components/Wordmark.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import PinEntry, { type PinCheck } from '$lib/components/PinEntry.svelte';
	// The front-facing sitting pose: of the 25, the one that still reads as a frog when
	// drawn in a single flat color.
	import mystery_frog from '$lib/assets/frogs/frog-0-13.webp';
	import Check from '@lucide/svelte/icons/check';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { hcaptcha_site_key, recaptcha_key } from '$lib/config';
	import { signedIn } from '$lib/stores';

	const { t } = getLocalization();

	interface Props {
		game_pin: string;
		game_mode: any;
		username: any;
		/** Bindable so the page can arrive here with a reason, e.g. after a kick. */
		error_message?: string;
	}

	let {
		game_pin = $bindable(),
		game_mode = $bindable(),
		username = $bindable(),
		error_message = $bindable('')
	}: Props = $props();
	let custom_field = $state<string | null>(null);
	// The nickname step shows once the server has confirmed the PIN, never on the PIN's
	// length: the sixth digit used to show it straight away, then take it back, PIN and
	// any nickname typed meanwhile with it, when the server said no such game (#82).
	let pin_ok = $state(false);
	// A PIN in the address (the home page's Join, or the QR code) goes straight on once the
	// game is found; only the first time, so Change does not bounce back past the PIN.
	let from_link = $state(game_pin !== '');
	// '' rather than undefined: this is bound to a text input, and an undefined
	// value there makes Svelte render the box with the literal string "undefined"
	// the first time a keystroke is undone, and sends undefined on submit even
	// though the server distinguishes "" (not supplied) from a real answer.
	let custom_field_value = $state('');
	let captcha_enabled = $state();
	// error_message is shown under the form instead of a browser alert(), which on a
	// phone is a system dialog that reads like the page has crashed.

	// The server takes any non-blank nickname. The old minimum of four rejected "Ana"
	// and "Rui" with a grayed-out button and no word of why.
	const MIN_NICKNAME = 2;

	// Mirrors MAX_CUSTOM_FIELD_LENGTH in frogquiz/socket_server/models.py. Without
	// it a player could type past the server's cap and only find out by having the
	// join rejected, with nothing shown on this screen to say why.
	const MAX_CUSTOM_FIELD_LENGTH = 200;

	// Mirrors the input's maxlength. The server allows 50, but a longer name is cut on the
	// lobby and the podium.
	const MAX_NICKNAME = 17;
	// The count shows once the end is near enough to matter, not from the first letter.
	const SHOW_COUNT_FROM = 12;

	// Players kept typing the PIN again as their name. All digits is a nudge, not an error
	// -- "007" is a fine nickname -- so Join stays enabled.
	const looks_like_pin = $derived(/^\d+$/.test(String(username ?? '').trim()));
	const name_length = $derived(Array.from(String(username ?? '')).length);
	// Set by a Join pressed with one letter, and cleared by the next edit. Join is not
	// disabled for it: a disabled button gives no reason, and it blocks Enter too.
	let too_short = $state(false);
	// Read back as two groups of three, the way the host screen shows it.
	const pin_display = $derived(`${game_pin.slice(0, 3)} ${game_pin.slice(3)}`);

	let hcaptchaSitekey = hcaptcha_site_key;

	let hcaptcha = {
		execute: async (_a, _b) => ({ response: '' }), // eslint-disable-line @typescript-eslint/no-unused-vars
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		render: (_a, _b) => {} // eslint-disable-line @typescript-eslint/no-unused-vars
	};
	let hcaptchaWidgetID;

	onMount(() => {
		if (browser) {
			prefetch_username();
			hcaptcha = window.hcaptcha;
			if (hcaptcha.render) {
				hcaptchaWidgetID = hcaptcha.render('hcaptcha', {
					sitekey: hcaptchaSitekey,
					size: 'invisible',
					theme: 'dark'
				});
			}
		}
	});

	onDestroy(() => {
		if (browser) {
			hcaptcha = {
				execute: async () => ({ response: '' }),
				// eslint-disable-next-line @typescript-eslint/no-empty-function
				render: () => {}
			};
		}
	});

	const prefetch_username = async () => {
		// Signed out, the request can only 401, and the browser logs that as an error.
		if (!$signedIn) return;
		const res = await fetch('/api/v1/users/me');
		if (res.status !== 200) {
			return;
		}
		const json = await res.json();
		username = json.username;
	};

	const accepted = (_pin: string, check: PinCheck) => {
		game_mode = check.game_mode;
		captcha_enabled = check.captcha;
		custom_field = check.custom_field;
		error_message = '';
		pin_ok = true;
	};

	// A PIN in the address is one the game turned down: reloading would only ask again.
	const forget_pin_in_url = () => {
		if (!page.url.searchParams.has('pin')) return;
		const url = new URL(page.url);
		url.searchParams.delete('pin');
		url.searchParams.delete('ref');
		replaceState(url, {});
	};

	// Back to the PIN, which stays on screen to be corrected rather than typed again.
	const refused = (message: string) => {
		from_link = false;
		pin_ok = false;
		error_message = message;
		forget_pin_in_url();
	};

	const setUsername = async (e: Event) => {
		e.preventDefault();
		// Trim before both the check and the send. Untrimmed, four spaces passed
		// as a nickname and the server -- which does bound and trim it -- would
		// then reject a join the form had accepted, with nothing shown here.
		username = username.trim();
		if (username.length < MIN_NICKNAME) {
			too_short = true;
			return;
		}
		let captcha_resp: string;
		// Holds the PIN of the game the host removed this player from. It used to be a
		// bare flag that silently refused every game for a day, with only a console
		// message to say why.
		if (Cookies.get('kicked') === game_pin) {
			error_message = $t('play_page.kicked');
			return;
		}
		error_message = '';

		if (captcha_enabled) {
			if (hcaptchaSitekey) {
				try {
					const { response } = await hcaptcha.execute(hcaptchaWidgetID, {
						async: true
					});
					captcha_resp = response;
					socket.emit('join_game', {
						username: username,
						game_pin: game_pin,
						captcha: captcha_resp,
						custom_field: custom_field ? custom_field_value : undefined
					});
				} catch (e) {
					console.error(e);
					/*					alertModal.set({
                        open: true,
                        body: "The captcha failed, which is normal, but most of the time it's fixed by reloading!",
                        title: 'Captcha failed'
                    });*/
					alert('Captcha failed. Reloading the page.');
					window.location.reload();
				}
			} else if (recaptcha_key) {
				// eslint-disable-next-line no-undef
				grecaptcha.ready(() => {
					// eslint-disable-next-line no-undef
					grecaptcha.execute(recaptcha_key, { action: 'submit' }).then(function (token) {
						socket.emit('join_game', {
							username: username,
							game_pin: game_pin,
							captcha: token,
							custom_field: custom_field ? custom_field_value : undefined
						});
					});
				});
			}
		} else {
			socket.emit('join_game', {
				username: username,
				game_pin: game_pin,
				captcha: undefined,
				custom_field: custom_field ? custom_field_value : undefined
			});
		}
	};
	socket.on('game_not_found', () => refused($t('play_page.game_not_found')));
	socket.on('game_locked', () => refused($t('play_page.game_locked')));
	socket.on('game_finished', () => refused($t('play_page.game_finished')));
	socket.on('username_already_exists', () => {
		error_message = $t('play_page.username_taken');
	});
</script>

<svelte:head>
	{#if captcha_enabled && hcaptchaSitekey}
		<script src="https://js.hcaptcha.com/1/api.js" async defer></script>
	{/if}
	{#if recaptcha_key && captcha_enabled}
		<script src="https://www.google.com/recaptcha/api.js?render={recaptcha_key}"></script>
	{/if}
</svelte:head>

<!-- fq-stage, not min-h-screen: 100vh counts browser chrome that is not there on a
     phone, which is where every player is, and pushed the submit button below the
     fold.
     This screen is the first thing every player sees, and it was a floating label, an
     unlabeled box and a gray Submit on an empty page -- while the landing page next
     door already did the same job in a card. Same card here: the mark, so you can see
     you are in the right place, one field, and one full-width primary action. -->
<!-- fq-stage centers on both axes, which is right for the game surfaces a room reads and
     wrong for a form: at 1440x900 the card floated with roughly 40% of the viewport empty
     above it and read as a page that had failed to load. Centered on a phone, where it is
     correct and where every player actually is; biased upward from `sm` so a host testing
     on a laptop sees a form rather than a void. fq-stage itself is untouched. -->
<div class="fq-stage sm:justify-start sm:pt-[14vh]">
	<div class="flex w-full max-w-sm flex-col items-center gap-6">
		<!-- The page had no heading at all; the mark and the card say it visually. -->
		<h1 class="sr-only">{$t('play_page.join_title')}</h1>
		<Wordmark size={44} />

		{#if !pin_ok}
			<PinEntry
				bind:value={game_pin}
				bind:error={error_message}
				autofocus
				onaccepted={accepted}
				onrejected={forget_pin_in_url}
				{from_link}
			/>
		{:else}
			<form
				onsubmit={setUsername}
				class="border-border/70 bg-card w-full rounded-xl border p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-24px_rgba(0,0,0,0.25)]"
			>
				<!-- The step before, and a way back to it: a player on the wrong game used to
				     have to reload. Redesigned 16 Oct (#82): this card had five lines of text
				     before its field, a heading and a label that both said "nickname", and a
				     hint that read as an error before anything was typed. -->
				<div class="flex items-center justify-between gap-3">
					<p class="text-muted-foreground flex items-center gap-1.5 text-sm">
						<Check class="size-4" aria-hidden="true" />
						{$t('play_page.pin_accepted', { pin: pin_display })}
					</p>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						class="-mr-2 h-11 px-3"
						onclick={() => {
							error_message = '';
							from_link = false;
							pin_ok = false;
						}}
					>
						{$t('play_page.change_pin')}
					</Button>
				</div>

				<!-- A silhouette: the player's own frog comes with their seat, which the server
				     hands out on join, so the lobby is where it is revealed. Decorative: the
				     line under it says what it is. -->
				<div class="mt-4 flex flex-col items-center gap-2" data-testid="nickname-frog">
					<div class="bg-muted relative size-24 rounded-full" aria-hidden="true">
						<img
							src={mystery_frog}
							alt=""
							class="size-full object-contain p-[9%] opacity-15 brightness-0 dark:opacity-30 dark:invert"
						/>
						<span
							class="bg-background text-muted-foreground ring-border absolute right-0.5 bottom-0.5 flex size-7 items-center justify-center rounded-full text-sm font-semibold ring-1"
						>
							?
						</span>
					</div>
					<p class="text-muted-foreground text-sm">{$t('play_page.frog_waiting')}</p>
				</div>

				<Label for="join-username" class="mt-6 text-base font-medium"
					>{$t('play_page.nickname_label')}</Label
				>
				<!-- autocomplete="nickname", not the browser default of guessing: with no
				     token at all Chrome and Safari read this as an account field and
				     offered the player's saved email address for what is a game nickname
				     shown to the whole room. autofocus because Join swaps this form in and
				     removes the field that had focus: without it focus fell to <body>, a
				     phone's keyboard closed between the two fields, and a typed name went
				     nowhere. -->
				<Input
					id="join-username"
					bind:value={username}
					oninput={() => {
						// An edit answers whatever was said about the last name, "already
						// taken" included, which otherwise hid "too short" behind it.
						too_short = false;
						error_message = '';
					}}
					maxlength={MAX_NICKNAME}
					autocomplete="nickname"
					placeholder={$t('play_page.nickname_placeholder')}
					aria-describedby="join-username-message"
					class="mt-2 h-12 text-lg"
					autofocus
				/>
				<!-- One row for whichever message applies, its height held so that nothing
				     below moves when one appears. The note about the PIN used to take the
				     hint's place in bold and push the button down a line. -->
				<!-- Not a live region itself: the alert and status inside it announce
				     themselves, and the count is read with the field's description rather
				     than on every keystroke. -->
				<div
					id="join-username-message"
					class="mt-2 flex min-h-5 items-start justify-between gap-3 text-sm"
				>
					{#if error_message}
						<p class="text-destructive text-balance" role="alert">{error_message}</p>
					{:else if too_short}
						<p class="text-destructive" role="alert">
							{$t('play_page.nickname_too_short', { count: MIN_NICKNAME })}
						</p>
					{:else if looks_like_pin}
						<p class="text-muted-foreground" role="status">
							{$t('play_page.nickname_looks_like_pin')}
						</p>
					{:else}
						<span></span>
					{/if}
					{#if name_length >= SHOW_COUNT_FROM}
						<span class="text-muted-foreground shrink-0 tabular-nums">
							{name_length}/{MAX_NICKNAME}
						</span>
					{/if}
				</div>

				{#if custom_field}
					<!-- The label text is whatever the host typed when starting the game, so it
					     is tied to the input with for/id rather than left as a heading that
					     happens to sit above it. -->
					<Label
						for="join-custom-field"
						class="mt-4 block text-base font-medium text-balance"
					>
						{custom_field}
					</Label>
					<Input
						id="join-custom-field"
						bind:value={custom_field_value}
						maxlength={MAX_CUSTOM_FIELD_LENGTH}
						autocomplete="off"
						class="mt-2 h-12"
					/>
				{/if}

				<Button type="submit" size="lg" class="mt-4 h-12 w-full" onclick={setUsername}>
					{$t('play_page.join_game')}
				</Button>
			</form>
		{/if}
	</div>
</div>
<div
	id="hcaptcha"
	class="h-captcha"
	data-sitekey={hcaptchaSitekey}
	data-size="invisible"
	data-theme="dark"
></div>
