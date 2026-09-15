<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<!-- Step one of recovery: ask for a link. (Step two, choosing the new password,
     is /account/password-reset -- the near-identical names are upstream's and are
     kept because the second one is baked into every reset email already sent.)

     Was four `alert()` calls over an upstream floating-label form, one of which
     said "user not found!" -- an oracle for whether an address has an account
     here, and a lie besides, since the API has never returned 404. Rebuilt on the
     same Card primitives as login and register, with one neutral outcome. -->
<script lang="ts">
	import { getLocalization } from '$lib/i18n';
	import { navbarVisible } from '$lib/stores.svelte.ts';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';

	navbarVisible.visible = true;
	const { t } = getLocalization();

	let email = $state('');
	let isSubmitting = $state(false);
	let result: 'sent' | 'too_many' | 'no_mail' | 'failed' | null = $state(null);

	const submit = async (e: Event) => {
		e.preventDefault();
		isSubmitting = true;
		result = null;
		try {
			const res = await fetch('/api/v1/users/forgot-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});
			if (res.ok) {
				result = 'sent';
			} else if (res.status === 429) {
				result = 'too_many';
			} else if (res.status === 503) {
				result = 'no_mail';
			} else {
				result = 'failed';
			}
		} catch {
			result = 'failed';
		} finally {
			isSubmitting = false;
		}
	};
</script>

<svelte:head>
	<title>frogQuiz - Reset your password</title>
</svelte:head>

<div class="flex min-h-dvh items-center justify-center px-4 py-10">
	<Card.Root class="w-full max-w-sm">
		<Card.Header class="gap-1 text-center">
			<Card.Title class="text-2xl">{$t('password_reset_page.reset_password')}</Card.Title>
			<Card.Description>{$t('password_reset_page.request_subtitle')}</Card.Description>
		</Card.Header>

		<Card.Content>
			<form onsubmit={submit} class="grid gap-4">
				<div class="grid gap-2">
					<Label for="email">{$t('words.email')}</Label>
					<Input
						id="email"
						name="email"
						type="email"
						autocomplete="email"
						required
						bind:value={email}
					/>
				</div>
				<Button type="submit" class="w-full" disabled={isSubmitting || email.length === 0}>
					{#if isSubmitting}
						<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
					{/if}
					{$t('password_reset_page.send_link')}
				</Button>
			</form>
		</Card.Content>

		{#if result !== null}
			{@const ok = result === 'sent'}
			<div class="px-6 pb-2">
				<div
					class="flex gap-3 rounded-lg border p-3 text-sm {ok
						? 'border-border bg-muted/50'
						: 'border-destructive/40 bg-destructive/10'}"
					role="status"
					aria-live="polite"
				>
					{#if ok}
						<CircleCheck
							class="text-foreground mt-0.5 size-4 shrink-0"
							aria-hidden="true"
						/>
					{:else}
						<CircleAlert
							class="text-destructive mt-0.5 size-4 shrink-0"
							aria-hidden="true"
						/>
					{/if}
					<p class={ok ? 'text-foreground' : 'text-destructive'}>
						{#if result === 'sent'}
							{$t('password_reset_page.sent')}
						{:else if result === 'too_many'}
							{$t('password_reset_page.send_too_many')}
						{:else if result === 'no_mail'}
							{$t('password_reset_page.no_mail')}
						{:else}
							{$t('password_reset_page.send_failed')}
						{/if}
					</p>
				</div>
			</div>
		{/if}

		<Card.Footer class="justify-center gap-1.5 text-sm">
			<span class="text-muted-foreground">{$t('password_reset_page.remembered')}</span>
			<a
				href="/account/login"
				class="text-primary font-medium underline-offset-4 hover:underline"
				>{$t('words.login')}</a
			>
		</Card.Footer>
	</Card.Root>
</div>
