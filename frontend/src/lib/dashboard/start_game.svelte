<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import Spinner from '$lib/Spinner.svelte';
	import { onMount } from 'svelte';
	import { getLocalization } from '$lib/i18n';
	import { getAnonSecret } from '$lib/anon_quiz';

	const { t } = getLocalization();
	let { quiz_id = $bindable() } = $props();
	let loading = $state(false);
	let custom_field = $state('');
	let randomized_answers = $state(false);
	let error = $state<string | null>(null);
	// Set when the failure looks like "you are not signed in" rather than a real
	// error, so the message can offer a way back rather than just saying no.
	let offer_login = $state(false);

	onMount(() => {
		const ls_data = localStorage.getItem('custom_field');
		custom_field = ls_data ? ls_data : '';
	});

	// Mode picker (Normal / Old-School) was cut: Old-School was never used, and Normal
	// is now the only option. The API still accepts game_mode=normal, so it can come
	// back without a backend change if that's ever wanted.
	const start_game = async (id: string) => {
		loading = true;
		error = null;
		offer_login = false;
		localStorage.setItem('custom_field', custom_field);
		const anon_secret = getAnonSecret(id);
		const headers: Record<string, string> = anon_secret ? { 'X-Anon-Secret': anon_secret } : {};

		// custom_field is whatever the host typed and used to be interpolated straight
		// into the query string. An `&` in it started a new parameter and truncated the
		// value; a `#` made everything after it a fragment, so the server never saw it.
		const params = new URLSearchParams({
			captcha_enabled: 'False',
			game_mode: 'kahoot',
			custom_field,
			cqcs_enabled: 'False',
			randomize_answers: randomized_answers ? 'True' : 'False'
		});
		const res = await fetch(`/api/v1/quiz/start/${encodeURIComponent(id)}?${params}`, {
			method: 'POST',
			headers
		});

		if (res.status === 200) {
			const data = await res.json();
			window.location.assign(
				`/admin?token=${data.game_id}&pin=${data.game_pin}&connect=1&cqc_code=${data.cqc_code}`
			);
			return;
		}

		loading = false;

		// This used to bounce to /account/login on *any* non-200 whenever there was no
		// anonymous secret -- so a 500, a rate limit, or a quiz deleted in another tab
		// all threw a signed-in host out of the page as though their session had
		// expired. Only an explicit 401/403 means that.
		if (res.status === 401 || res.status === 403) {
			window.location.assign('/account/login?returnTo=/dashboard');
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
	};
</script>

<Dialog.Root {open} onOpenChange={on_open_change}>
	<Dialog.Content class="gap-5">
		<Dialog.Header>
			<Dialog.Title>{$t('start_game.start_game')}</Dialog.Title>
		</Dialog.Header>

		<div class="grid gap-2">
			<Label for="custom-field">{$t('result_page.custom_field')}</Label>
			<Input id="custom-field" bind:value={custom_field} placeholder="Phone Number or Email" />
		</div>

		<div class="flex items-center gap-3">
			<Switch id="randomize-answers" bind:checked={randomized_answers} />
			<Label for="randomize-answers">{$t('start_game.randomize_answers')}</Label>
		</div>

		{#if error}
			<div class="text-destructive text-sm" role="alert">
				<p>{error}</p>
				{#if offer_login}
					<Button
						href="/account/login?returnTo=/dashboard"
						variant="link"
						class="text-destructive h-auto p-0"
					>
						{$t('words.login')}
					</Button>
				{/if}
			</div>
		{/if}

		<Dialog.Footer>
			<Button
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
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
