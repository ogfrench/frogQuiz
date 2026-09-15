<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { getLocalization } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';

	let {
		session_data,
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

<!-- The page already shows the wordmark above this card, so the step no longer repeats it. -->
<form class="flex flex-col gap-(--card-spacing)" onsubmit={continue_in_login}>
	<div class="flex flex-col gap-2">
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
		<div
			class="border-destructive/40 bg-destructive/10 flex gap-3 rounded-lg border p-3 text-sm"
			role="alert"
		>
			<CircleAlert class="text-destructive mt-0.5 size-4 shrink-0" aria-hidden="true" />
			<div class="text-destructive">
				{#if error === 'too_many'}
					<p>{$t('login_page.too_many')}</p>
				{:else if error === 'failed'}
					<p>{$t('login_page.failed')}</p>
				{:else}
					<p>{$t('login_page.wrong_credentials')}</p>
					<!-- An account that has not confirmed its address is refused here with
					     exactly this response, on purpose: saying otherwise would tell a
					     stranger which addresses are registered. The cost is that the one
					     person it locks out cannot tell why, so the way out is offered on
					     every failure rather than only on the one that needs it. -->
					<p class="mt-1">
						{$t('login_page.unconfirmed_hint')}
						<a
							href="/account/resend-verification"
							class="font-medium underline underline-offset-4"
							>{$t('login_page.unconfirmed_link')}</a
						>
					</p>
				{/if}
			</div>
		</div>
	{/if}
	<Button type="submit" class="w-full" disabled={!password || isSubmitting}>
		{#if isSubmitting}
			<LoaderCircle class="animate-spin" />
		{/if}
		{$t('words.continue')}
	</Button>
</form>
