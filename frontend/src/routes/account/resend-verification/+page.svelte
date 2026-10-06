<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<!-- The way out of the one dead end in this flow. An account that has not confirmed
     its address is refused at login with the same "wrong credentials" as a bad
     password -- deliberately, so the login endpoint cannot be used to test which
     addresses are registered -- which leaves the person who typed the right
     password with no way to find out what is wrong. This page is what the login
     error and the "already taken" case on registration both point at. -->
<script lang="ts">
	import { getLocalization } from '$lib/i18n';
	import { navbarVisible } from '$lib/stores.svelte.ts';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { onDestroy } from 'svelte';
	import { cooldownFromRefusal, createCooldown, formatWait } from '$lib/resend_cooldown.svelte';
	import QuarantineNotice from '$lib/QuarantineNotice.svelte';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';

	navbarVisible.visible = true;
	const { t } = getLocalization();

	let email = $state('');
	let isSubmitting = $state(false);
	let result: 'sent' | 'too_many' | 'no_mail' | 'failed' | null = $state(null);

	// Held for a minute after each send: the server refuses sooner anyway, and a third
	// quick click spends the address's hourly three and earns "try again in an hour".
	const cooldown = createCooldown();
	onDestroy(cooldown.stop);

	const submit = async (e: Event) => {
		e.preventDefault();
		if (cooldown.active) return;
		isSubmitting = true;
		result = null;
		try {
			const res = await fetch('/api/v1/users/resend-verification', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});
			if (res.ok) {
				result = 'sent';
				cooldown.start();
			} else if (res.status === 429) {
				const wait = cooldownFromRefusal(res);
				if (wait > 0) {
					// the cooldown, not the hourly limit: say how long, not "an hour"
					cooldown.start(wait);
					result = null;
				} else {
					result = 'too_many';
				}
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
	<title>frogQuiz - Resend confirmation email</title>
</svelte:head>

<div class="flex min-h-dvh items-center justify-center px-4 py-10">
	<Card.Root class="w-full max-w-sm">
		<Card.Header class="gap-1 text-center">
			<h1 data-slot="card-title" class="text-2xl font-semibold tracking-tight">
				{$t('resend_page.title')}
			</h1>
			<Card.Description>{$t('resend_page.subtitle')}</Card.Description>
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
				<Button
					type="submit"
					class="w-full"
					disabled={isSubmitting || email.length === 0 || cooldown.active}
				>
					{#if isSubmitting}
						<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
					{/if}
					{#if cooldown.active}
						{$t('resend_page.wait', { time: formatWait(cooldown.left) })}
					{:else}
						{$t('resend_page.action')}
					{/if}
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
							{$t('resend_page.sent')}
						{:else if result === 'too_many'}
							{$t('resend_page.too_many')}
						{:else if result === 'no_mail'}
							{$t('password_reset_page.no_mail')}
						{:else}
							{$t('resend_page.failed')}
						{/if}
					</p>
				</div>
			</div>
		{/if}

		{#if result === 'sent'}
			<div class="px-6 pb-2">
				<QuarantineNotice />
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
