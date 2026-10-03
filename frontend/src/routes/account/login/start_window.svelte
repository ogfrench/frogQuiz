<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { getLocalization } from '$lib/i18n';
	import OAuthBlock from './oauth_block.svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { page } from '$app/state';
	import { registration_disabled } from '$lib/config';
	import { safeReturnTo } from '$lib/return_to';

	let { session_data = $bindable({}), step = $bindable(), identifier = $bindable('') } = $props();

	const { t } = getLocalization();

	// This is now the only way to registration: the navbar offers Log in alone. So the
	// link carries returnTo on (the register page hands it back to its own Log in link)
	// and honours registration_disabled, which the navbar used to do for it.
	const return_to = $derived(safeReturnTo(page.url.searchParams.get('returnTo'), ''));
	const register_href = $derived(
		return_to
			? `/account/register?returnTo=${encodeURIComponent(return_to)}`
			: '/account/register'
	);

	let email = $state('');
	let emailEmpty = $derived(email === '');
	let isSubmitting = $state(false);

	const start_login = async (e: Event): Promise<void> => {
		e.preventDefault();
		if (emailEmpty) {
			return;
		}
		isSubmitting = true;

		const res = await fetch('/api/v1/login/start', {
			method: 'post',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ email: email })
		});
		session_data = await res.json();
		identifier = email;
		step = 1;
	};
</script>

<!-- The heading says what the page is for, as reset-password's always did. It read
     "frogQuiz", which the navbar already says, and was a <div>, so the page had no h1. -->
<Card.Header class="gap-1 text-center">
	<h1 data-slot="card-title" class="text-2xl font-semibold tracking-tight">
		{$t('words.login')}
	</h1>
	<Card.Description>{$t('login_page.welcome_back')}</Card.Description>
</Card.Header>

<Card.Content>
	<form onsubmit={start_login} class="grid gap-4">
		<div class="grid gap-2">
			<Label for="email">{$t('login_page.email_or_username')}</Label>
			<Input id="email" bind:value={email} name="email" type="text" autocomplete="email" />
		</div>

		<div class="flex items-center justify-between gap-4">
			<a
				href="/account/reset-password"
				class="text-muted-foreground hover:text-foreground text-sm underline-offset-4 transition-colors hover:underline"
			>
				{$t('register_page.forgot_password?')}
			</a>

			<Button type="submit" disabled={emailEmpty || isSubmitting}>
				{#if isSubmitting}
					<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
					<span class="sr-only">{$t('words.continue')}</span>
				{:else}
					{$t('words.continue')}
				{/if}
			</Button>
		</div>

		<OAuthBlock />
	</form>
</Card.Content>

{#if !registration_disabled}
	<Card.Footer class="bg-muted/50 justify-center gap-1 border-t py-4 text-sm">
		<span class="text-muted-foreground">{$t('login_page.already_have_account')}</span>
		<a
			href={register_href}
			class="text-primary font-semibold underline-offset-4 hover:underline"
		>
			{$t('words.register')}
		</a>
	</Card.Footer>
{/if}
