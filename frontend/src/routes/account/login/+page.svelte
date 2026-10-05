<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	// Sign-in by an emailed link or six-digit code, for frog and Capgemini addresses, with no
	// passwords (François, 5 Oct; the same gate frogViz uses). A first sign-in picks a
	// username and that makes the account, so there is no separate registration. The
	// password steps this page used to run (start_window, select_method, password_component,
	// backup_component) are kept beside it, unused, for ENABLE_PASSWORD_LOGIN.
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { getLocalization } from '$lib/i18n';
	import { navbarVisible } from '$lib/stores.svelte';
	import { safeReturnTo } from '$lib/return_to';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import VerifiedBadge from './verified_badge.svelte';
	import TotpComponent from './totp_component.svelte';

	navbarVisible.visible = true;

	let { data } = $props();
	const { t } = getLocalization();

	type Stage = 'email' | 'code' | 'link' | 'username' | 'totp';
	const token = page.url.searchParams.get('token');
	let stage = $state<Stage>(token ? 'link' : 'email');
	let email = $state('');
	let code = $state('');
	let username = $state('');
	let error = $state('');
	let busy = $state(false);
	let challenge = '';
	let signup = '';
	let return_to: string | null = null;
	let totp_session = $state<{ session_id: string; step_2: string[] }>();
	let totp_step = $state(2);
	let totp_method = $state('TOTP');
	let totp_done = $state(false);

	// A full load rather than goto(): the session cookies were set by this response, and
	// the layout reads who is signed in on the server.
	const signedIn = (target: string | null) => {
		window.location.replace(
			safeReturnTo(target ?? page.url.searchParams.get('returnTo'), '/my-quizzes')
		);
	};

	$effect(() => {
		if (totp_done) signedIn(return_to);
	});

	const post = (path: string, body: object) =>
		fetch(`/api/v1/login/${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

	const errorFor = (status: number, detail: string): string => {
		if (status === 401 && /link/.test(detail)) return $t('sign_in.errors.link_expired');
		if (status === 401 && /expired/.test(detail)) return $t('sign_in.errors.code_expired');
		if (status === 401) return $t('sign_in.errors.wrong_code');
		if (status === 429 && stage === 'code') return $t('sign_in.errors.too_many_tries');
		if (status === 423) return $t('sign_in.errors.closed');
		return $t('sign_in.errors.unknown');
	};

	// Where the link, the code and a returning TOTP user all end up.
	const finish = async (res: Response) => {
		const body = await res.json().catch(() => ({}));
		return_to = body.return_to ?? null;
		if (res.status === 202) {
			totp_session = body;
			stage = 'totp';
		} else if (res.ok && body.signup) {
			signup = body.signup;
			stage = 'username';
		} else if (res.ok) {
			signedIn(return_to);
			return;
		} else {
			error = errorFor(res.status, String(body.detail ?? ''));
			if (stage === 'link') stage = 'email';
		}
		busy = false;
	};

	const sendLink = async (e: Event) => {
		e.preventDefault();
		if (busy || email.trim() === '') return;
		busy = true;
		error = '';
		const res = await post('email', {
			email: email.trim(),
			return_to: page.url.searchParams.get('returnTo')
		}).catch(() => null);
		busy = false;
		if (res?.ok) {
			challenge = (await res.json()).challenge;
			code = '';
			stage = 'code';
			return;
		}
		const status = res?.status ?? 0;
		error =
			status === 403
				? $t('sign_in.errors.domain')
				: status === 400 || status === 422
					? $t('sign_in.errors.invalid')
					: status === 429
						? $t('sign_in.errors.too_many_emails')
						: $t('sign_in.errors.send_failed');
	};

	const sendCode = async (e: Event) => {
		e.preventDefault();
		if (busy || code.length !== 6) return;
		busy = true;
		error = '';
		await finish(await post('email/verify', { challenge, code }));
	};

	const createAccount = async (e: Event) => {
		e.preventDefault();
		if (busy) return;
		const name = username.trim();
		if (name.length < 3 || name.length > 20) {
			error = $t('sign_in.errors.username_length');
			return;
		}
		busy = true;
		error = '';
		const res = await post('email/signup', { signup, username: name });
		busy = false;
		if (res.ok) {
			signedIn(return_to);
		} else if (res.status === 409) {
			error = $t('sign_in.errors.username_taken');
		} else if (res.status === 422) {
			error = $t('sign_in.errors.username_length');
		} else {
			error = $t('sign_in.errors.link_expired');
			stage = 'email';
		}
	};

	// Digits only, six at most, so a code pasted as "123 456" still works (as the PIN box, E10).
	$effect(() => {
		const cleaned = code.replace(/\D/g, '').slice(0, 6);
		if (cleaned !== code) code = cleaned;
	});

	onMount(async () => {
		if (!token) return;
		busy = true;
		await finish(await post('email/verify', { token }));
		// Out of the address bar and the history: it signs in whoever holds it, for 15
		// minutes. After the request, not before: replaceState throws until the router has
		// started, which is after this runs, and that left the page on "Signing you in".
		const clean = new URL(page.url);
		clean.searchParams.delete('token');
		replaceState(clean, {});
	});
</script>

<svelte:head>
	<title>frogQuiz - {$t('sign_in.title')}</title>
</svelte:head>
<div class="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center px-4">
	{#if data.notice}
		<VerifiedBadge state={data.notice} />
	{/if}

	<Card.Root class="w-full max-w-sm overflow-hidden pt-6 pb-6 shadow-xl">
		{#if stage === 'totp' && totp_session}
			<TotpComponent
				session_data={totp_session}
				bind:step={totp_step}
				bind:selected_method={totp_method}
				bind:done={totp_done}
			/>
		{:else}
			<Card.Header class="gap-1 text-center">
				<h1 data-slot="card-title" class="text-2xl font-semibold tracking-tight">
					{stage === 'username'
						? $t('sign_in.pick_username')
						: stage === 'code'
							? $t('sign_in.check_inbox')
							: $t('sign_in.title')}
				</h1>
				<Card.Description>
					{#if stage === 'username'}
						{$t('sign_in.username_blurb')}
					{:else if stage === 'code'}
						{$t('sign_in.sent_to', { email: email.trim() })}
					{:else if stage === 'email'}
						{$t('sign_in.blurb')}
					{/if}
				</Card.Description>
			</Card.Header>

			<Card.Content>
				{#if stage === 'link'}
					<p class="text-muted-foreground flex items-center justify-center gap-2 text-sm">
						<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
						{$t('sign_in.signing_in')}
					</p>
				{:else if stage === 'email'}
					<form onsubmit={sendLink} class="grid gap-4">
						<div class="grid gap-2">
							<Label for="email">{$t('sign_in.email')}</Label>
							<Input
								id="email"
								type="email"
								name="email"
								autocomplete="email"
								placeholder="name@frog.co"
								bind:value={email}
								aria-invalid={error ? 'true' : undefined}
								aria-describedby={error ? 'sign-in-error' : undefined}
							/>
						</div>
						{@render problem()}
						<Button type="submit" disabled={busy || email.trim() === ''}>
							{#if busy}<LoaderCircle
									class="size-4 animate-spin"
									aria-hidden="true"
								/>{/if}
							{$t('sign_in.send')}
						</Button>
					</form>
				{:else if stage === 'code'}
					<form onsubmit={sendCode} class="grid gap-4">
						<div class="grid gap-2">
							<Label for="code">{$t('sign_in.code')}</Label>
							<Input
								id="code"
								name="code"
								inputmode="numeric"
								autocomplete="one-time-code"
								class="text-center font-mono text-lg tracking-[0.3em]"
								bind:value={code}
								aria-invalid={error ? 'true' : undefined}
								aria-describedby={error ? 'sign-in-error' : undefined}
							/>
						</div>
						{@render problem()}
						<Button type="submit" disabled={busy || code.length !== 6}>
							{#if busy}<LoaderCircle
									class="size-4 animate-spin"
									aria-hidden="true"
								/>{/if}
							{$t('sign_in.sign_in')}
						</Button>
						<Button
							type="button"
							variant="ghost"
							onclick={() => {
								stage = 'email';
								error = '';
							}}
						>
							{$t('sign_in.other_address')}
						</Button>
					</form>
				{:else if stage === 'username'}
					<form onsubmit={createAccount} class="grid gap-4">
						<div class="grid gap-2">
							<Label for="username">{$t('sign_in.username')}</Label>
							<Input
								id="username"
								name="username"
								autocomplete="username"
								maxlength={20}
								bind:value={username}
								aria-invalid={error ? 'true' : undefined}
								aria-describedby={error ? 'sign-in-error' : undefined}
							/>
						</div>
						{@render problem()}
						<Button type="submit" disabled={busy || username.trim() === ''}>
							{#if busy}<LoaderCircle
									class="size-4 animate-spin"
									aria-hidden="true"
								/>{/if}
							{$t('sign_in.create')}
						</Button>
					</form>
				{/if}
			</Card.Content>
		{/if}
	</Card.Root>
</div>

{#snippet problem()}
	{#if error}
		<p id="sign-in-error" class="text-destructive text-sm" role="alert">{error}</p>
	{/if}
{/snippet}
