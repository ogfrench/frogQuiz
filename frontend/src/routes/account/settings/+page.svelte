<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { getLocalization } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button/index.js';
	import { DateTime } from 'luxon';
	import { UAParser } from 'ua-parser-js';
	import Spinner from '$lib/Spinner.svelte';
	import BrownButton from '$lib/components/buttons/brown.svelte';

	const { t } = getLocalization();

	interface UserAccount {
		id: string;
		email: string;
		username: string;
		verified: boolean;
		created_at: string;
	}

	interface ChangePasswordData {
		oldPassword: string;
		newPassword: string;
		newPasswordConfirm: string;
	}

	let changePasswordData: ChangePasswordData = $state({
		oldPassword: '',
		newPassword: '',
		newPasswordConfirm: ''
	});

	let this_session = $state();

	let passwordChangeDataValid = $derived(
		changePasswordData.newPassword === changePasswordData.newPasswordConfirm &&
			changePasswordData.newPassword.length >= 8 &&
			changePasswordData.oldPassword !== changePasswordData.newPassword &&
			changePasswordData.oldPassword !== ''
	);

	const changePassword = async (e: Event) => {
		e.preventDefault();
		if (!passwordChangeDataValid) {
			return;
		}
		const res = await fetch('/api/v1/users/password/update', {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				old_password: changePasswordData.oldPassword,
				new_password: changePasswordData.newPassword
			})
		});
		if (res.status === 200) {
			alert('Password changed');
			window.location.assign('/account/login');
		} else {
			alert('Password change failed');
		}
	};

	const getUser = async (): Promise<UserAccount> => {
		const response = await fetch('/api/v1/users/me', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		});
		if (response.status === 200) {
			return await response.json();
		} else {
			window.location.assign('/account/login');
		}
	};

	const formatDate = (date: string): string => {
		const dt = DateTime.fromISO(date);
		return dt.toLocaleString(DateTime.DATETIME_MED);
	};

	const getSessions = async () => {
		const res = await fetch('/api/v1/users/sessions/list');
		if (res.status === 200) {
			const res2 = await fetch('/api/v1/users/session');
			if (res2.status === 200) {
				this_session = await res2.json();
			}
			return await res.json();
		} else {
			window.location.assign('/account/login?returnTo=/account/settings');
		}
		return await res.json();
	};

	const getFormattedUserAgent = (userAgent: string): string => {
		const parser = new UAParser(userAgent);
		const result = parser.getResult();
		return `${result.browser.name} ${result.browser.version} (${result.os.name})`;
	};

	const deleteSession = async (session_id: string) => {
		const res = await fetch(`/api/v1/users/sessions/${session_id}`, {
			method: 'DELETE'
		});
		if (res.status === 200) {
			window.location.reload();
		}
	};
</script>

<svelte:head>
	<title>frogQuiz - Settings</title>
</svelte:head>

{#await getUser()}
	<Spinner />
{:then user}
	<div class="w-full grid grid-cols-6">
		<div>
			<img
				class="rounded-md md:w-80"
				src="/api/v1/users/avatar"
				alt="Profile image of {user.username}"
			/>
			<div class="m-2 flex justify-center">
				<BrownButton href="/account/settings/avatar"
					>{$t('settings_page.change_avatar')}</BrownButton
				>
			</div>
		</div>
		<div class="grid grid-rows-2 col-start-2 col-end-7">
			<div class="grid grid-cols-2">
				<div>
					<h1 class="text-4xl font-bold my-2">{user.username}</h1>
					<p class="text-lg mb-6 md:max-w-lg">
						{$t('words.email')}: {user.email}
					</p>
				</div>
				<div class="p-4 flex justify-center">
					<div class="m-auto">
						<BrownButton href="/user/{user.id}">Public profile page</BrownButton>
					</div>
				</div>
			</div>
			<div>
				<form class="flex flex-col md:flex-row" onsubmit={changePassword}>
					<label
						>{$t('settings_page.old_password')}:<input
							type="password"
							class="border-input bg-background text-foreground focus-visible:ring-ring m-2 min-h-11 rounded-md border p-2 focus-visible:ring-2 focus-visible:outline-none"
							bind:value={changePasswordData.oldPassword}
						/></label
					>
					<label
						>{$t('settings_page.new_password')}:<input
							type="password"
							class="border-input bg-background text-foreground focus-visible:ring-ring m-2 min-h-11 rounded-md border p-2 focus-visible:ring-2 focus-visible:outline-none"
							bind:value={changePasswordData.newPassword}
						/></label
					>
					<label
						>{$t('settings_page.repeat_password')}:<input
							type="password"
							class="border-input bg-background text-foreground focus-visible:ring-ring m-2 min-h-11 rounded-md border p-2 focus-visible:ring-2 focus-visible:outline-none"
							bind:value={changePasswordData.newPasswordConfirm}
						/></label
					>
					<div class="my-auto">
						<BrownButton disabled={!passwordChangeDataValid} type="submit">
							{$t('settings_page.change_password_submit')}
						</BrownButton>
					</div>
				</form>
			</div>
		</div>
	</div>
{/await}
{#await getSessions()}
	<Spinner />
{:then sessions}
	<!-- A bare table with whitespace-nowrap cells and px-6 padding, and no scroll
	     container: 539px of horizontal overflow on a phone. CLAUDE.md's own rule is that
	     a table may be wider than the page only inside its own overflow-x container.
	     Delete was a bare <button> with no box at all, so its target was the 42x20 of
	     its text. -->
	<div class="mx-auto w-full max-w-5xl px-4">
		<h2 class="mb-3 text-lg font-semibold tracking-tight">
			{$t('settings_page.sessions') ?? 'Sessions'}
		</h2>
		<div class="border-border fq-scroll-x rounded-xl border">
			<table class="w-full text-left text-sm">
				<thead
					class="bg-muted/50 text-muted-foreground text-xs font-medium tracking-wider uppercase"
				>
					<tr>
						<th scope="col" class="px-4 py-3">{$t('overview_page.created_at')}</th>
						<th scope="col" class="px-4 py-3">{$t('settings_page.last_seen')}</th>
						<th scope="col" class="px-4 py-3">{$t('words.browser')}</th>
						<th scope="col" class="px-4 py-3">{$t('settings_page.this_session?')}</th>
						<th scope="col" class="px-4 py-3">
							<span class="sr-only">{$t('settings_page.delete_this_session')}</span>
						</th>
					</tr>
				</thead>
				<tbody class="divide-border divide-y">
					{#each sessions as session}
						<tr>
							<td class="text-muted-foreground px-4 py-3 whitespace-nowrap">
								{formatDate(session.created_at)}
							</td>
							<td class="text-muted-foreground px-4 py-3 whitespace-nowrap">
								{formatDate(session.last_seen)}
							</td>
							<td class="px-4 py-3">{getFormattedUserAgent(session.user_agent)}</td>
							<td class="px-4 py-3 whitespace-nowrap">
								{#if session.id === this_session?.id}
									<span
										class="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium"
										>{$t('settings_page.this_session?')}</span
									>
								{:else}
									<span class="text-muted-foreground">&mdash;</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-right whitespace-nowrap">
								<Button
									type="button"
									variant="destructive"
									size="sm"
									onclick={() => {
										deleteSession(session.id);
									}}
								>
									{$t('words.delete')}
								</Button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/await}
