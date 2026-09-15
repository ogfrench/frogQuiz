<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { getLocalization } from '$lib/i18n';

	const { t } = getLocalization();
	let { data } = $props();
	let { token }: { token: string } = data;
	let isSubmitting = $state(false);
	interface PasswordData {
		password1: string;
		password2: string;
	}
	let passwordData: PasswordData = $state({
		password1: '',
		password2: ''
	});
	let passwordsValid = $derived(
		passwordData.password1 === passwordData.password2 && passwordData.password1.length >= 8
	);

	const submit = async (e: Event) => {
		e.preventDefault();
		if (!passwordsValid) {
			return;
		}
		isSubmitting = true;
		const response = await fetch('/api/v1/users/reset-password', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				password: passwordData.password1,
				token
			})
		});
		const data = await response.json();
		if (response.status === 200) {
			window.location.assign('/account/login');
		} else {
			alert(data.detail);
		}
		isSubmitting = false;
	};
</script>

<svelte:head>
	<title>frogQuiz - Reset your Password</title>
</svelte:head>

<div class="flex items-center justify-center h-full px-4">
	<div>
		<div
			class="w-full max-w-sm mx-auto overflow-hidden border-border bg-card rounded-xl border shadow-sm"
		>
			<div class="px-6 py-4">
				<h2 class="text-3xl font-bold tracking-tight text-center">frogQuiz</h2>

				<!--
								<h3 class='mt-1 text-lg font-medium text-center'>
								</h3>
				-->

				<p class="text-muted-foreground mt-1 text-center">
					{$t('password_reset_page.reset_password')}
				</p>

				<form onsubmit={submit}>
					<div class="w-full mt-4">
						<div class="bg-card rounded-lg p-4">
							<div class="relative bg-inherit w-full">
								<input
									id="password1"
									bind:value={passwordData.password1}
									name="password1"
									type="password"
									class="peer text-foreground ring-input focus:ring-ring min-h-11 w-full rounded-lg bg-transparent px-2 ring-2 placeholder-transparent focus:outline-hidden"
									placeholder={$t('words.password')}
								/>
								<label
									for="password1"
									class="text-foreground peer-placeholder-shown:text-muted-foreground peer-focus:text-primary absolute -top-3 left-0 mx-1 cursor-text bg-inherit px-1 text-sm transition-all peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-focus:-top-3 peer-focus:text-sm"
								>
									{$t('words.password')}
								</label>
							</div>
						</div>
						<div class="bg-card rounded-lg p-4">
							<div class="relative bg-inherit w-full">
								<input
									id="password2"
									name="password2"
									type="password"
									bind:value={passwordData.password2}
									class="peer text-foreground ring-input focus:ring-ring min-h-11 w-full rounded-lg bg-transparent px-2 ring-2 placeholder-transparent focus:outline-hidden"
									placeholder={$t('words.repeat_password')}
								/>
								<label
									for="password2"
									class="text-foreground peer-placeholder-shown:text-muted-foreground peer-focus:text-primary absolute -top-3 left-0 mx-1 cursor-text bg-inherit px-1 text-sm transition-all peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-focus:-top-3 peer-focus:text-sm"
								>
									{$t('words.repeat_password')}
								</label>
							</div>
						</div>

						<div class="flex items-center justify-between mt-4">
							<a
								href="/account/login"
								class="text-muted-foreground hover:text-foreground fq-touch-target relative inline-flex min-h-11 items-center text-sm underline-offset-4 transition-colors hover:underline"
								>{$t('register_page.already_have_account?')}</a
							>

							<button
								class="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring fq-touch-target relative inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
								disabled={!passwordsValid}
								type="submit"
							>
								{#if isSubmitting}
									<svg class="h-4 w-4 animate-spin mx-auto" viewBox="3 3 18 18">
										<path
											class="fill-black"
											d="M12 5C8.13401 5 5 8.13401 5 12C5 15.866 8.13401 19 12 19C15.866 19 19 15.866 19 12C19 8.13401 15.866 5 12 5ZM3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12Z"
										/>
										<path
											class="fill-blue-100"
											d="M16.9497 7.05015C14.2161 4.31648 9.78392 4.31648 7.05025 7.05015C6.65973 7.44067 6.02656 7.44067 5.63604 7.05015C5.24551 6.65962 5.24551 6.02646 5.63604 5.63593C9.15076 2.12121 14.8492 2.12121 18.364 5.63593C18.7545 6.02646 18.7545 6.65962 18.364 7.05015C17.9734 7.44067 17.3403 7.44067 16.9497 7.05015Z"
										/>
									</svg>
								{:else}
									{$t('words.submit')}
								{/if}
							</button>
						</div>
					</div>
				</form>
			</div>

			<div
				class="border-border bg-muted/40 flex items-center justify-center gap-1.5 border-t py-4 text-center"
			>
				<span class="text-muted-foreground text-sm"
					>{$t('login_page.already_have_account')}
				</span>

				<a
					href="/account/register"
					class="text-primary fq-touch-target relative inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 transition-colors hover:underline"
					>{$t('words.register')}</a
				>
			</div>
		</div>
	</div>
</div>
