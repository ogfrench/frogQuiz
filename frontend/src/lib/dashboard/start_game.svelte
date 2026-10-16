<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Spinner from '$lib/Spinner.svelte';
	import { getLocalization } from '$lib/i18n';
	import { getAnonSecret } from '$lib/anon_quiz';

	const { t } = getLocalization();
	// `newTab` is the editor's Play: the game opens beside the editor, so the author keeps
	// their place. The view page and My Quizzes leave it off and the game replaces them.
	let { quiz_id = $bindable(), newTab = false } = $props();
	let loading = $state(false);
	let custom_field = $state('');
	// The custom field is an extra question every player is asked on the join screen,
	// and the host's answer to it is shown to them as the heading above that box. It
	// used to be pre-filled from localStorage on mount, so a value typed once -- in
	// practice somebody's own email -- silently re-applied to every game started in
	// that browser from then on, and every player saw it labeling a mystery input.
	// It is now an explicit opt-in that starts empty for every game, and nothing is
	// persisted: the only thing the stored value was ever used for was that
	// auto-prefill, so keeping the write would leave a value nothing reads. The
	// feature itself, and its whole wire path, is untouched.
	let custom_field_enabled = $state(false);
	let randomized_answers = $state(false);
	// Kahoot's own "Show questions & answers on participants' devices", which is free on
	// every Kahoot plan and off by default. Off, the phone shows four colored shapes and
	// the question lives on the shared screen; on, the phone carries the question text,
	// its image and the answer text too. That is the difference between a room with a
	// projector and a video call, which is why it is the host's choice per game and not a
	// product decision (MVP.md D16).
	let show_on_devices = $state(false);
	// The three switches live under "Game options", folded away: nearly every game starts
	// with the defaults, so the one big button is all most hosts ever reach for.
	let options_open = $state(false);
	let error = $state<string | null>(null);
	// Set when the failure looks like "you are not signed in" rather than a real
	// error, so the message can offer a way back rather than just saying no.
	let offer_login = $state(false);

	// Clearing on the way out keeps the value that gets sent equal to the value that
	// is visible: a host who types something and then changes their mind would
	// otherwise still ship it, since the input is only hidden, not unmounted.
	const on_custom_field_toggle = (enabled: boolean) => {
		custom_field_enabled = enabled;
		if (!enabled) {
			custom_field = '';
		}
	};

	// This string is rendered to every player as the heading above the extra box, so
	// bound it. The same 200 as MAX_CUSTOM_FIELD_LENGTH in
	// frogquiz/socket_server/models.py, which bounds the players' answers -- the
	// server does not bound the prompt itself, hence the client-side cap.
	const MAX_CUSTOM_FIELD_LENGTH = 200;

	// `game_mode` is what carries the switch above. Both render paths already existed and
	// both work -- upstream exposed them as two game modes, a choice made before the game
	// started and labeled "Normal" and "Old-School", which told a host nothing about what
	// it did. Same wire value, named after its effect.
	const start_game = async (id: string) => {
		loading = true;
		error = null;
		offer_login = false;
		const anon_secret = getAnonSecret(id);
		const headers: Record<string, string> = anon_secret ? { 'X-Anon-Secret': anon_secret } : {};

		// A window opened after the fetch comes back is no longer part of the click, and a
		// popup blocker refuses it. So the blank tab is opened now, while this still is the
		// click, and pointed at the game once the server has answered. Blocked anyway
		// (null), the game replaces this tab as it does everywhere else. The opener is
		// dropped at once: the game tab has no business reaching back into the editor.
		const tab = newTab ? window.open('', '_blank') : null;
		if (tab) tab.opener = null;
		const close_tab = () => tab?.close();

		// custom_field is whatever the host typed and used to be interpolated straight
		// into the query string. An `&` in it started a new parameter and truncated the
		// value; a `#` made everything after it a fragment, so the server never saw it.
		const params = new URLSearchParams({
			captcha_enabled: 'False',
			game_mode: show_on_devices ? 'normal' : 'kahoot',
			custom_field,
			cqcs_enabled: 'False',
			randomize_answers: randomized_answers ? 'True' : 'False'
		});
		let res: Response;
		try {
			res = await fetch(`/api/v1/quiz/start/${encodeURIComponent(id)}?${params}`, {
				method: 'POST',
				headers
			});
		} catch {
			// Offline. The spinner used to spin on for ever here, and a blank tab would too.
			loading = false;
			close_tab();
			error = $t('start_game.start_failed');
			return;
		}

		if (res.status === 200) {
			let data;
			try {
				data = await res.json();
			} catch {
				// A 200 that is not JSON (a proxy's error page): failed like any other.
				loading = false;
				close_tab();
				error = $t('start_game.start_failed');
				return;
			}
			const path = `/admin?token=${data.game_id}&pin=${data.game_pin}&connect=1&cqc_code=${data.cqc_code}`;
			// Closed while the server answered (by the person, or a blocker that hands back a
			// closed window): the game opens here instead of nowhere.
			if (tab && !tab.closed) {
				tab.location.href = `${window.location.origin}${path}`;
				// This tab stays where it is, so the dialog goes and the next game starts clean.
				on_open_change(false);
			} else {
				window.location.assign(path);
			}
			return;
		}

		loading = false;
		close_tab();

		// This used to bounce to /account/login on *any* non-200 whenever there was no
		// anonymous secret -- so a 500, a rate limit, or a quiz deleted in another tab
		// all threw a signed-in host out of the page as though their session had
		// expired. Only an explicit 401/403 means that. From the editor the blank tab is
		// already closed above, and this tab goes to the login: its work was saved first.
		if (res.status === 401 || res.status === 403) {
			window.location.assign('/account/login?returnTo=/my-quizzes');
			return;
		}

		// Without a secret the caller is treated as anonymous by the API, so a 404 here
		// is ambiguous: the quiz may be gone, or the session may have lapsed and this is
		// somebody's own quiz they can no longer prove they own. Say so and offer the
		// way back rather than guessing and navigating away.
		if (res.status === 404 && !anon_secret) {
			error = $t('start_game.start_failed_signed_out');
			offer_login = true;
			return;
		}

		// A 400 here is the server refusing a specific quiz for a specific reason (a
		// draft with an unfinished question, most often) rather than a generic
		// failure, so its `detail` is worth showing rather than a one-size message.
		if (res.status === 400) {
			try {
				const body = await res.json();
				if (typeof body?.detail === 'string' && body.detail) {
					error = body.detail;
					return;
				}
			} catch {
				// Fall through to the generic message below.
			}
		}

		error = $t('start_game.start_failed');
	};

	const open = $derived(quiz_id !== null);
	const on_open_change = (is_open: boolean) => {
		if (!is_open) {
			quiz_id = null;
		}
		// A failure left over from the last quiz would otherwise still be showing the
		// next time the dialog opens.
		error = null;
		offer_login = false;
		loading = false;
		// Every game starts from the same blank slate, including the next one opened
		// from this same dashboard without a reload.
		custom_field_enabled = false;
		custom_field = '';
		randomized_answers = false;
		show_on_devices = false;
		options_open = false;
	};
</script>

<!-- The label and hint run flush left at the row's full width, the switch sits on the
     right and lines up with the label's first line (not centered, which floated it beside
     the third line of a wrapped hint on a phone). No leading-none on the labels: two-line
     ones touched at 390. Light text on a dark ground reads heavier at the same numeric
     weight, so the dark weights are lighter: 380 puts about as much ink on the screen as
     500 does in light (a pixel count on 390px screenshots), where the old 500 put 27% more. -->
<Dialog.Root {open} onOpenChange={on_open_change}>
	<Dialog.Content class="gap-5">
		<Dialog.Header>
			<Dialog.Title>{$t('start_game.start_game')}</Dialog.Title>
			<Dialog.Description>{$t('start_game.players_join')}</Dialog.Description>
		</Dialog.Header>

		<Button
			size="lg"
			class="w-full"
			onclick={() => {
				start_game(quiz_id);
			}}
			disabled={loading}
		>
			{#if loading}
				<Spinner my_20={false} />
			{:else}
				{$t('start_game.start_game')}
			{/if}
		</Button>

		{#if error}
			<div class="text-destructive text-sm" role="alert">
				<p>{error}</p>
				{#if offer_login}
					<Button
						href="/account/login?returnTo=/my-quizzes"
						variant="link"
						class="text-destructive h-auto p-0"
					>
						{$t('words.login')}
					</Button>
				{/if}
			</div>
		{/if}

		<Collapsible.Root bind:open={options_open} class="border-border min-w-0 border-t pt-1.5">
			<Collapsible.Trigger
				type="button"
				class="focus-visible:ring-ring/50 flex min-h-11 w-full items-center justify-between gap-2 rounded-md text-left text-sm font-medium outline-none focus-visible:ring-3 dark:font-[380]"
			>
				{$t('start_game.game_options')}
				<ChevronDown
					class="text-muted-foreground size-4 shrink-0 transition-transform duration-(--fq-dur-control) {options_open
						? 'rotate-180'
						: ''}"
					aria-hidden="true"
				/>
			</Collapsible.Trigger>
			<Collapsible.Content>
				<div class="divide-border divide-y pt-2">
					<!-- The switch is the only thing that opens the box under it, so the
					     collapsible is driven rather than self-controlled; onOpenChange keeps
					     the two in step if bits-ui ever closes it itself (escape, a forced
					     remount). -->
					<Collapsible.Root
						open={custom_field_enabled}
						onOpenChange={on_custom_field_toggle}
						class="py-3.5 first:pt-1.5"
					>
						<!-- Was "Custom field" with nothing to say what it does, and an English,
						     Title Case "Phone Number or Email" placeholder outside the locale file. -->
						<div class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1">
							<Label
								for="custom-field-enabled"
								class="col-start-1 row-start-1 leading-snug dark:font-[380]"
							>
								{$t('start_game.custom_field')}
							</Label>
							<Switch
								id="custom-field-enabled"
								class="col-start-2 row-span-2 row-start-1"
								checked={custom_field_enabled}
								onCheckedChange={on_custom_field_toggle}
								aria-describedby="custom-field-hint"
							/>
							<p id="custom-field-hint" class="text-muted-foreground col-start-1 row-start-2 text-sm">
								{$t('start_game.custom_field_hint')}
							</p>
						</div>
						<Collapsible.Content>
							<div class="grid min-w-0 gap-2 pt-3">
								<Label for="custom-field" class="sr-only">
									{$t('start_game.custom_field_name')}
								</Label>
								<Input
									id="custom-field"
									bind:value={custom_field}
									maxlength={MAX_CUSTOM_FIELD_LENGTH}
									placeholder={$t('start_game.custom_field_placeholder')}
								/>
							</div>
						</Collapsible.Content>
					</Collapsible.Root>

					<div class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 py-3.5">
						<Label for="randomize-answers" class="leading-snug dark:font-[380]">
							{$t('start_game.randomize_answers')}
						</Label>
						<Switch id="randomize-answers" bind:checked={randomized_answers} />
					</div>

					<div
						class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 py-3.5 last:pb-1.5"
					>
						<Label
							for="show-on-devices"
							class="col-start-1 row-start-1 leading-snug dark:font-[380]"
						>
							{$t('start_game.show_on_devices')}
						</Label>
						<Switch
							id="show-on-devices"
							class="col-start-2 row-span-2 row-start-1"
							bind:checked={show_on_devices}
							aria-describedby="show-on-devices-hint"
						/>
						<p
							id="show-on-devices-hint"
							class="text-muted-foreground col-start-1 row-start-2 text-sm"
						>
							{$t('start_game.show_on_devices_hint')}
						</p>
					</div>
				</div>
			</Collapsible.Content>
		</Collapsible.Root>
	</Dialog.Content>
</Dialog.Root>
