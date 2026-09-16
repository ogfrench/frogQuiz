<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { getLocalization } from '$lib/i18n';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';

	// "expired" covers both ways a confirmation link stops working: it was already
	// used, or asking for a new mail replaced it. Neither is an error the person
	// can do anything about without being told what to do next.
	//
	// "deleted" and "password_changed" are the other two things that end with a
	// redirect here, and they want the same quiet status line rather than a second
	// component that looks almost like this one.
	let { state }: { state: 'true' | 'expired' | 'deleted' | 'password_changed' } = $props();
	const { t } = getLocalization();
	const ok = $derived(state !== 'expired');
</script>

<div
	class="mx-auto mb-4 flex w-full max-w-sm gap-3 rounded-lg border p-3 text-sm {ok
		? 'border-border bg-muted/50'
		: 'border-destructive/40 bg-destructive/10'}"
	role="status"
	aria-live="polite"
>
	{#if ok}
		<CircleCheck class="text-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
		<p class="text-foreground">
			{#if state === 'deleted'}
				{$t('login_page.account_deleted')}
			{:else if state === 'password_changed'}
				{$t('settings_page.password_changed')}
			{:else}
				{$t('login_page.verified')}
			{/if}
		</p>
	{:else}
		<CircleAlert class="text-destructive mt-0.5 size-4 shrink-0" aria-hidden="true" />
		<p class="text-destructive">
			{$t('login_page.verify_link_dead')}
			<a href="/account/resend-verification" class="font-medium underline underline-offset-4"
				>{$t('login_page.verify_link_resend')}</a
			>
		</p>
	{/if}
</div>
