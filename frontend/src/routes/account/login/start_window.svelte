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

	let { session_data = $bindable({}), step = $bindable() } = $props();

	const { t } = getLocalization();
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
		step = 1;
	};
</script>

<Card.Header class="gap-1 text-center">
	<Card.Title class="text-3xl font-bold tracking-tight">frogQuiz</Card.Title>
	<Card.Description class="grid gap-1">
		<span class="text-foreground text-lg font-medium">{$t('login_page.welcome_back')}</span>
		<span>{$t('login_page.login_or_create_account')}</span>
	</Card.Description>
</Card.Header>

<Card.Content>
	<form onsubmit={start_login} class="grid gap-4">
		<div class="grid gap-2">
			<Label for="email">{$t('login_page.email_or_username')}</Label>
			<Input
				id="email"
				bind:value={email}
				name="email"
				type="text"
				placeholder={$t('login_page.email_or_username')}
				autocomplete="email"
			/>
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

<Card.Footer class="bg-muted/50 justify-center gap-1 border-t py-4 text-sm">
	<span class="text-muted-foreground">{$t('login_page.already_have_account')}</span>
	<a
		href="/account/register"
		class="text-primary font-semibold underline-offset-4 hover:underline"
	>
		{$t('words.register')}
	</a>
</Card.Footer>
