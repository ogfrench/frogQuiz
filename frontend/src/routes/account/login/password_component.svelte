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

	const continue_in_login = async (e: Event) => {
		e.preventDefault();
		if (!password || isSubmitting) {
			return;
		}
		isSubmitting = true;
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
				let data;
				try {
					data = await res.json();
				} catch {
					alert("This shouldn't happen");
					window.location.reload();
				}
				if (data.detail === 'wrong credentials') {
					alert('Wrong credentials');
				}
			}
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
	<Button type="submit" class="w-full" disabled={!password || isSubmitting}>
		{#if isSubmitting}
			<LoaderCircle class="animate-spin" />
		{/if}
		{$t('words.continue')}
	</Button>
</form>
