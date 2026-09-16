<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { getLocalization } from '$lib/i18n';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';

	let {
		session_data,
		identifier = '',
		restart = () => {},
		selected_method = $bindable(),
		done = $bindable(),
		step = $bindable()
	} = $props();

	const { t } = getLocalization();
	// This was declared but never assigned, so the button never showed a pending state and
	// nothing stopped a second submit while the first was in flight.
	let isSubmitting = $state(false);
	let password = $state();
	// Every failure here used to be an alert() or, for anything that wasn't a 401
	// with the exact detail "wrong credentials", nothing at all -- the spinner
	// stopped and the form sat there. A rate-limited login was completely silent.
	let error: 'credentials' | 'too_many' | 'failed' | null = $state(null);

	const continue_in_login = async (e: Event) => {
		e.preventDefault();
		if (!password || isSubmitting) {
			return;
		}
		isSubmitting = true;
		error = null;
		try {
			const res = await fetch(`/api/v1/login/step/1?session_id=${session_data.session_id}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ auth_type: 'PASSWORD', data: password })
			});
			if (res.status === 200) {
				window.location.reload();
				done = true;
			} else if (res.status === 202) {
				step += 1;
				selected_method = null;
			} else if (res.status === 401) {
				error = 'credentials';
			} else if (res.status === 429) {
				error = 'too_many';
			} else {
				error = 'failed';
			}
		} catch {
			error = 'failed';
		} finally {
			isSubmitting = false;
		}
	};
</script>

<!-- Same Header/Content/Footer shape as the first step, which this replaces in
     place: without it the card opened straight onto a Password label, flush to
     the edge, with no wordmark, no account and nothing to go back to. -->
<Card.Header class="gap-1 text-center">
	<Card.Title class="text-3xl font-bold tracking-tight">frogQuiz</Card.Title>
	<Card.Description class="grid gap-1">
		<span class="text-foreground text-lg font-medium">{$t('login_page.welcome_back')}</span>
		{#if identifier}
			<span class="flex min-w-0 items-center justify-center gap-1.5">
				<span class="truncate">{identifier}</span>
				<button
					type="button"
					onclick={restart}
					class="text-muted-foreground hover:text-foreground shrink-0 underline underline-offset-4"
				>
					{$t('login_page.change_account')}
				</button>
			</span>
		{/if}
	</Card.Description>
</Card.Header>

<Card.Content>
	<form class="grid gap-4" onsubmit={continue_in_login}>
		<div class="grid gap-2">
			<Label for="password">{$t('words.password')}</Label>
			<Input
				id="password"
				bind:value={password}
				name="password"
				type="password"
				autocomplete="current-password"
			/>
		</div>

		{#if error !== null}
			<!-- One line. The recovery hint below is the part that is mostly
			     boilerplate, and putting it inside the red box made four lines of
			     alarm out of one fact. -->
			<p
				class="text-destructive flex items-start gap-2 text-sm"
				role="alert"
				aria-live="polite"
			>
				<CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
				<span>
					{#if error === 'too_many'}
						{$t('login_page.too_many')}
					{:else if error === 'failed'}
						{$t('login_page.failed')}
					{:else}
						{$t('login_page.wrong_credentials')}
					{/if}
				</span>
			</p>
		{/if}

		<Button type="submit" class="w-full" disabled={!password || isSubmitting}>
			{#if isSubmitting}
				<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
			{/if}
			{$t('words.continue')}
		</Button>

		{#if error === 'credentials'}
			<!-- An account that has not confirmed its address is refused here with
			     exactly this response, on purpose: saying otherwise would tell a
			     stranger which addresses are registered. The cost is that the one
			     person it locks out cannot tell why, so the way out is offered on
			     every credential failure rather than only on the one that needs it --
			     quietly, because for everyone else it is noise. -->
			<p class="text-muted-foreground text-center text-sm">
				{$t('login_page.unconfirmed_hint')}
				<a
					href="/account/resend-verification"
					class="text-foreground font-medium underline underline-offset-4"
					>{$t('login_page.unconfirmed_link')}</a
				>
			</p>
		{/if}
	</form>
</Card.Content>

<Card.Footer class="bg-muted/50 justify-center border-t py-4 text-sm">
	<a
		href="/account/reset-password"
		class="text-muted-foreground hover:text-foreground underline-offset-4 transition-colors hover:underline"
	>
		{$t('register_page.forgot_password?')}
	</a>
</Card.Footer>
