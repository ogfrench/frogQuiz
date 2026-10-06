<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { getLocalization } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button/index.js';
	import { onDestroy } from 'svelte';
	import { cooldownFromRefusal, createCooldown, formatWait } from '$lib/resend_cooldown.svelte';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';

	const { t } = getLocalization();

	let { email }: { email: string } = $props();

	// The settings page fetched `verified` and never rendered it, so someone whose
	// confirmation mail was lost or filtered had no way of learning that from the
	// one page about their account -- they had to find /account/resend-verification
	// on their own.
	let state: 'idle' | 'sending' | 'sent' | 'failed' = $state('idle');
	const cooldown = createCooldown();
	onDestroy(cooldown.stop);

	const resend = async () => {
		if (state === 'sending' || cooldown.active) {
			return;
		}
		state = 'sending';
		try {
			const res = await fetch('/api/v1/users/resend-verification', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});
			// 429 and 503 land here too. The endpoint answers identically whether or
			// not the address is known, and there is nothing useful to distinguish
			// for someone who is looking at their own signed-in settings page.
			state = res.ok ? 'sent' : 'failed';
			if (res.ok) {
				cooldown.start();
			} else {
				// ...except a refusal that names a short wait, which is the cooldown.
				const wait = cooldownFromRefusal(res);
				if (wait > 0) {
					cooldown.start(wait);
					state = 'idle';
				}
			}
		} catch {
			state = 'failed';
		}
	};
</script>

<div
	class="border-destructive/40 bg-destructive/10 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
	role="status"
	aria-live="polite"
>
	<div class="flex gap-3">
		<CircleAlert class="text-destructive mt-0.5 size-4 shrink-0" aria-hidden="true" />
		<div>
			<p class="text-foreground text-sm font-medium">
				{$t('settings_page.unverified_title')}
			</p>
			<p class="text-muted-foreground mt-1 text-sm">{$t('settings_page.unverified_body')}</p>
		</div>
	</div>
	<div class="shrink-0 sm:pl-3">
		{#if state === 'sent'}
			<p class="text-muted-foreground text-sm">{$t('settings_page.unverified_sent')}</p>
		{/if}
		<Button
			variant="outline"
			class={state === 'sent' ? 'mt-2' : ''}
			onclick={resend}
			disabled={state === 'sending' || cooldown.active}
		>
			{#if state === 'sending'}
				<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
			{/if}
			{#if cooldown.active}
				{$t('settings_page.unverified_wait', { time: formatWait(cooldown.left) })}
			{:else}
				{$t('settings_page.unverified_resend')}
			{/if}
		</Button>
		{#if state === 'failed'}
			<p class="text-destructive mt-1 text-sm">{$t('settings_page.unverified_failed')}</p>
		{/if}
	</div>
</div>
