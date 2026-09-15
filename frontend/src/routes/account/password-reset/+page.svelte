<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<!-- Step two of recovery: the page the link in the reset email lands on. (Step one,
     asking for the link, is /account/reset-password.)

     The failure path was `alert(data.detail)`, which put the raw API string in a
     native dialog -- so the single most common outcome, an expired or already-used
     token, read "Invalid token" with no way forward. It now says what happened and
     offers the one action that helps. -->
<script lang="ts">
	import { getLocalization } from '$lib/i18n';
	import { navbarVisible } from '$lib/stores.svelte.ts';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';

	navbarVisible.visible = true;
	const { t } = getLocalization();

	let { data }: { data: { token: string | null } } = $props();

	let password1 = $state('');
	let password2 = $state('');
	let isSubmitting = $state(false);
	let result: 'invalid_token' | 'failed' | null = $state(null);

	let passwordsValid = $derived(password1 === password2 && password1.length >= 8);
	// A dead link is worth saying up front rather than after someone has typed a
	// password twice and pressed the button.
	let hasToken = $derived(typeof data.token === 'string' && data.token.length > 0);

	const submit = async (e: Event) => {
		e.preventDefault();
		if (!passwordsValid || !hasToken) {
			return;
		}
		isSubmitting = true;
		result = null;
		try {
			const res = await fetch('/api/v1/users/reset-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password: password1, token: data.token })
			});
			if (res.ok) {
				// The API signs every session out, so there is nothing to keep here.
				window.location.assign('/account/login');
				return;
			}
			result = res.status === 400 ? 'invalid_token' : 'failed';
		} catch {
			result = 'failed';
		} finally {
			isSubmitting = false;
		}
	};
</script>

<svelte:head>
	<title>frogQuiz - Choose a new password</title>
</svelte:head>

<div class="flex min-h-dvh items-center justify-center px-4 py-10">
	<Card.Root class="w-full max-w-sm">
		<Card.Header class="gap-1 text-center">
			<Card.Title class="text-2xl">{$t('password_reset_page.choose_title')}</Card.Title>
			<Card.Description>{$t('password_reset_page.choose_subtitle')}</Card.Description>
		</Card.Header>

		<Card.Content>
			{#if hasToken}
				<form onsubmit={submit} class="grid gap-4">
					<div class="grid gap-2">
						<Label for="password1">{$t('words.password')}</Label>
						<Input
							id="password1"
							name="password1"
							type="password"
							autocomplete="new-password"
							required
							bind:value={password1}
						/>
					</div>
					<div class="grid gap-2">
						<Label for="password2">{$t('words.repeat_password')}</Label>
						<Input
							id="password2"
							name="password2"
							type="password"
							autocomplete="new-password"
							required
							bind:value={password2}
						/>
					</div>
					<Button type="submit" class="w-full" disabled={isSubmitting || !passwordsValid}>
						{#if isSubmitting}
							<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
						{/if}
						{$t('password_reset_page.set_password')}
					</Button>
				</form>
			{:else}
				<div
					class="border-destructive/40 bg-destructive/10 flex gap-3 rounded-lg border p-3 text-sm"
					role="alert"
				>
					<CircleAlert
						class="text-destructive mt-0.5 size-4 shrink-0"
						aria-hidden="true"
					/>
					<p class="text-destructive">{$t('password_reset_page.missing_token')}</p>
				</div>
			{/if}
		</Card.Content>

		{#if result !== null}
			<div class="px-6 pb-2">
				<div
					class="border-destructive/40 bg-destructive/10 flex gap-3 rounded-lg border p-3 text-sm"
					role="alert"
				>
					<CircleAlert
						class="text-destructive mt-0.5 size-4 shrink-0"
						aria-hidden="true"
					/>
					<p class="text-destructive">
						{result === 'invalid_token'
							? $t('password_reset_page.invalid_token')
							: $t('password_reset_page.set_failed')}
					</p>
				</div>
			</div>
		{/if}

		<Card.Footer class="flex-col gap-2">
			{#if !hasToken || result === 'invalid_token'}
				<Button href="/account/reset-password" variant="outline" class="w-full">
					{$t('password_reset_page.request_new')}
				</Button>
			{/if}
			<div class="flex justify-center gap-1.5 text-sm">
				<span class="text-muted-foreground">{$t('password_reset_page.remembered')}</span>
				<a
					href="/account/login"
					class="text-primary font-medium underline-offset-4 hover:underline"
					>{$t('words.login')}</a
				>
			</div>
		</Card.Footer>
	</Card.Root>
</div>
