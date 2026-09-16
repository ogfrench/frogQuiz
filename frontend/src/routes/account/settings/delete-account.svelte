<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { getLocalization } from '$lib/i18n';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	const { t } = getLocalization();

	let { authType = 'LOCAL' }: { authType?: string } = $props();

	// OAuth accounts are created without a password, so there is nothing to confirm
	// with. The API returns 400 for them; disabling the trigger says so up front
	// rather than after a failed attempt.
	const isLocal = $derived(authType === 'LOCAL');

	let open = $state(false);
	let password = $state('');
	let error = $state('');
	let isSubmitting = $state(false);
	// How much is about to go. Fetched when the dialog opens rather than on page
	// load, so the settings page costs nothing extra for the people who never open
	// it. null means "not known" -- the line is simply left out rather than
	// guessing at a number on a screen about an irreversible action.
	let quizCount: number | null = $state(null);

	const reset = () => {
		password = '';
		error = '';
	};

	const loadScope = async () => {
		try {
			const res = await fetch('/api/v1/quiz/list?page_size=100');
			if (res.status !== 200) {
				return;
			}
			const body = await res.json();
			quizCount = Array.isArray(body) ? body.length : null;
		} catch {
			// Not worth surfacing: the dialog still works without the count.
			quizCount = null;
		}
	};

	const deleteAccount = async () => {
		// The client half of the double-submit guard. The server has its own, because
		// a second request that arrives while the first is in flight authenticates
		// from a Redis entry the deleted row no longer backs.
		if (isSubmitting || password === '') {
			return;
		}
		isSubmitting = true;
		error = '';
		let res: Response;
		try {
			res = await fetch('/api/v1/users/me', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password })
			});
		} catch {
			isSubmitting = false;
			error = $t('settings_page.delete_failed');
			return;
		}
		isSubmitting = false;

		if (res.status === 200) {
			// A full document load, not goto(): `signedIn` is set server-side in
			// +layout.server.ts from the cookies, so only a real navigation picks up
			// that the server has just cleared them.
			window.location.assign('/account/login?deleted=true');
			return;
		}
		if (res.status === 401) {
			window.location.assign('/account/login?returnTo=/account/settings');
			return;
		}
		// Everything below leaves the dialog open on purpose. A failed delete that
		// bounced the user to a login page would read exactly like a successful one.
		password = '';
		if (res.status === 400) {
			error = $t('settings_page.delete_wrong_password');
		} else if (res.status === 429) {
			error = $t('settings_page.delete_too_many');
		} else {
			error = $t('settings_page.delete_failed');
		}
	};
</script>

<Card.Root class="border-destructive/40">
	<Card.Header>
		<Card.Title>{$t('settings_page.danger_section')}</Card.Title>
		<Card.Description>{$t('settings_page.danger_description')}</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if isLocal}
			<AlertDialog.Root bind:open onOpenChange={(o) => (o ? loadScope() : reset())}>
				<AlertDialog.Trigger class={buttonVariants({ variant: 'destructive' })}>
					<TriangleAlert class="size-4" aria-hidden="true" />
					{$t('settings_page.delete_account_button')}
				</AlertDialog.Trigger>
				<AlertDialog.Content class="max-w-md">
					<AlertDialog.Header>
						<AlertDialog.Title
							>{$t('settings_page.delete_confirm_title')}</AlertDialog.Title
						>
						<AlertDialog.Description>
							{$t('settings_page.delete_confirm_body')}
							{#if quizCount !== null && quizCount > 0}
								<span class="mt-2 block"
									>{$t('settings_page.delete_scope', { count: quizCount })}</span
								>
							{/if}
						</AlertDialog.Description>
					</AlertDialog.Header>

					<div class="flex flex-col gap-1.5">
						<Label for="delete-password"
							>{$t('settings_page.delete_password_hint')}</Label
						>
						<Input
							id="delete-password"
							type="password"
							autocomplete="current-password"
							bind:value={password}
							aria-invalid={error !== '' ? 'true' : undefined}
							aria-describedby={error !== '' ? 'delete-error' : undefined}
							onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && deleteAccount()}
						/>
						{#if error !== ''}
							<p
								id="delete-error"
								class="text-destructive text-sm"
								aria-live="polite"
							>
								{error}
							</p>
						{/if}
					</div>

					<AlertDialog.Footer>
						<AlertDialog.Cancel disabled={isSubmitting}
							>{$t('words.cancel')}</AlertDialog.Cancel
						>
						<!--
							A plain Button, not AlertDialog.Action: Action closes the dialog on
							click, which would hide the error from a wrong password.
						-->
						<Button
							variant="destructive"
							disabled={isSubmitting || password === ''}
							onclick={deleteAccount}
						>
							{#if isSubmitting}
								<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
							{/if}
							{$t('settings_page.delete_confirm_button')}
						</Button>
					</AlertDialog.Footer>
				</AlertDialog.Content>
			</AlertDialog.Root>
		{:else}
			<p class="text-muted-foreground text-sm">{$t('settings_page.delete_oauth_account')}</p>
		{/if}
	</Card.Content>
</Card.Root>
