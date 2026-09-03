<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import Spinner from '$lib/Spinner.svelte';
	import { browser } from '$app/environment';
	import TotpSetup from './totp_setup.svelte';
	import BackupCodes from './backup_codes.svelte';
	import BrownButton from '$lib/components/buttons/brown.svelte';
	import { getLocalization } from '$lib/i18n';

	const { t } = getLocalization();

	let user_data: object | undefined = $state();
	let totp_activated: boolean | undefined = $state();
	let totp_data = $state();
	let backup_code = $state();

	const get_data = async () => {
		const res1 = await fetch('/api/v1/users/me');
		user_data = await res1.json();
		const res3 = await fetch('/api/v1/users/2fa/totp');
		totp_activated = (await res3.json()).activated;
	};
	let data = $state(get_data());

	const save_password_required = async () => {
		console.log(user_data?.require_password, 'here');
		if (!browser || user_data?.require_password === undefined) {
			return;
		}
		const pw = require_password();
		const res = await fetch('/api/v1/users/2fa/require_password', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ require_password: user_data?.require_password, password: pw })
		});
		user_data.require_password = (await res.json()).require_password;
	};

	const require_password = (): string | null => {
		return prompt('Please enter your password to continue');
	};

	const disable_totp = async () => {
		const pw = require_password();
		if (!pw) return;
		const res = await fetch(`/api/v1/users/2fa/totp`, {
			method: 'DELETE',
			body: JSON.stringify({ password: pw }),
			headers: { 'Content-Type': 'application/json' }
		});
		if (res.status === 401) {
			alert('Password probably wrong');
			return;
		}
		data = get_data();
	};

	const enable_totp = async () => {
		const pw = require_password();
		if (!pw) return;
		const res = await fetch('/api/v1/users/2fa/totp', {
			method: 'POST',
			body: JSON.stringify({ password: pw }),
			headers: { 'Content-Type': 'application/json' }
		});
		if (res.status === 401) {
			alert('Password probably wrong');
			return;
		}
		data = get_data();
		totp_data = await res.json();
	};

	const get_backup_code = async () => {
		const pw = require_password();
		if (!pw) return;
		if (!confirm('If you continue, your old backup-code will be removed.')) {
			return;
		}
		const res = await fetch('/api/v1/users/2fa/backup_code', {
			method: 'POST',
			body: JSON.stringify({ password: pw }),
			headers: { 'Content-Type': 'application/json' }
		});
		if (res.status === 401) {
			alert('Password probably wrong');
			return;
		}
		backup_code = (await res.json()).code;
	};
</script>

{#await data}
	<Spinner my_20={false} />
{:then _}
	<div class="grid grid-rows-2 h-screen">
		<div class="grid grid-cols-2 h-full border-b-2 border-black">
			<div class="h-full w-full border-r-2 border-black">
				<h2 class="text-center text-2xl">{$t('security_settings.backup_code')}</h2>
				<div class="flex h-full w-full justify-center">
					<div class="m-auto">
						<BrownButton onclick={get_backup_code}
							>{$t('security_settings.get_backup_code')}</BrownButton
						>
					</div>
				</div>
			</div>
			<div class="h-full w-full">
				<h2 class="text-center text-2xl">{$t('security_settings.activate_2fa')}</h2>
				<div
					class="flex h-full w-full justify-center flex-col"
					class:pointer-events-none={!totp_activated}
					class:grayscale={!totp_activated}
					class:opacity-50={!totp_activated}
				>
					<div class="m-auto">
						{#if user_data.require_password}
							<div class="flex items-center space-x-2">
								<button
									disabled={!totp_activated}
									onclick={() => {
										user_data.require_password = !user_data.require_password;
										save_password_required();
									}}
									type="button"
									role="switch"
									aria-checked="true"
									class="relative inline-flex h-5 w-8 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-transparent bg-blue-700 transition focus:outline-hidden focus:ring focus:ring-blue-200"
								>
									<span
										aria-hidden="true"
										class="pointer-events-none inline-block h-4 w-4 translate-x-3 rounded-full bg-white transition will-change-transform"
									></span>
								</button>
								<span class="text-sm font-medium text-gray-700 dark:text-white"
									>{$t('security_settings.2fa_activated')}</span
								>
							</div>
						{:else}
							<div class="flex items-center space-x-2">
								<button
									disabled={!totp_activated}
									type="button"
									onclick={() => {
										user_data.require_password = !user_data.require_password;
										save_password_required();
									}}
									role="switch"
									aria-checked="false"
									class="relative inline-flex h-5 w-8 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-transparent bg-gray-200 transition focus:outline-hidden focus:ring focus:ring-blue-200"
								>
									<span
										aria-hidden="true"
										class="pointer-events-none inline-block h-4 w-4 translate-x-0 rounded-full bg-white transition will-change-transform"
									></span>
								</button>
								<span class="text-sm font-medium text-gray-700 dark:text-white"
									>{$t('security_settings.2fa_deactivated')}</span
								>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
		<div class="grid grid-cols-1 h-full">
			<div class="h-full w-full flex flex-col">
				<h2 class="text-center text-2xl">{$t('security_settings.totp')}</h2>
				<div class="flex justify-center">
					{#if totp_activated}
						<p>{$t('security_settings.totp_available')}</p>
					{:else}
						<p>{$t('security_settings.totp_unavailable')}</p>
					{/if}
				</div>

				<div class="flex justify-center">
					<div class="m-auto">
						{#if totp_activated}
							<BrownButton onclick={disable_totp}
								>{$t('security_settings.disable_totp')}</BrownButton
							>
						{:else}
							<BrownButton onclick={enable_totp}
								>{$t('security_settings.enable_totp')}</BrownButton
							>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
{/await}

{#if totp_data}
	<TotpSetup bind:totp_data />
{/if}

{#if backup_code}
	<BackupCodes bind:backup_code />
{/if}
