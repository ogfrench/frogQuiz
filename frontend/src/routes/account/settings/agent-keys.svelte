<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	// Keys for AI agents: what lets Claude, or any MCP client, list and make quizzes in this
	// account through the MCP service in mcp-server/ (docs/mcp.md). A key is shown once,
	// when it is made: the server keeps only its hash, so it cannot be shown again.
	import { getLocalization } from '$lib/i18n';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { DateTime } from 'luxon';
	import { onMount } from 'svelte';
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';

	const { t } = getLocalization();

	interface AgentKey {
		id: string;
		name: string;
		prefix: string;
		created_at: string;
		last_used_at: string | null;
	}

	// Off unless the API says the agent API is on: the section stays hidden rather than
	// handing out keys nothing accepts.
	let enabled = $state(false);
	let mcpUrl: string | null = $state(null);
	let keys: AgentKey[] = $state([]);
	let loaded = $state(false);

	let name = $state('');
	let isCreating = $state(false);
	let error = $state('');
	// The key just made, until Done. Never stored anywhere else.
	let created: { key: string; name: string } | null = $state(null);
	let copied: 'key' | 'command' | null = $state(null);

	let revoking: string | null = $state(null);

	const command = $derived(
		created && mcpUrl
			? `claude mcp add --scope user --transport http frogquiz ${mcpUrl} --header "Authorization: Bearer ${created.key}"`
			: ''
	);

	const formatDate = (date: string): string =>
		DateTime.fromISO(date).toLocaleString(DateTime.DATETIME_MED);

	const loadKeys = async () => {
		const res = await fetch('/api/v1/users/api_keys').catch(() => null);
		if (res?.status === 200) {
			keys = await res.json();
		}
		loaded = true;
	};

	onMount(async () => {
		const res = await fetch('/api/v1/utils/config').catch(() => null);
		if (res?.status !== 200) {
			return;
		}
		const config = await res.json();
		enabled = config.agent_api_enabled === true;
		mcpUrl =
			typeof config.mcp_url === 'string' && config.mcp_url !== '' ? config.mcp_url : null;
		if (enabled) {
			await loadKeys();
		}
	});

	const createKey = async (e: Event) => {
		e.preventDefault();
		if (isCreating || name.trim() === '') {
			return;
		}
		isCreating = true;
		error = '';
		let res: Response;
		try {
			res = await fetch('/api/v1/users/api_keys', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: name.trim() })
			});
		} catch {
			isCreating = false;
			error = $t('settings_page.agents_create_failed');
			return;
		}
		isCreating = false;
		if (res.status === 200) {
			const body = await res.json();
			created = { key: body.key, name: body.name };
			name = '';
			await loadKeys();
			return;
		}
		if (res.status === 401) {
			window.location.assign('/account/login?returnTo=/account/settings');
			return;
		}
		if (res.status === 409) {
			error = $t('settings_page.agents_too_many_keys');
		} else if (res.status === 429) {
			error = $t('settings_page.agents_too_many_tries');
		} else {
			error = $t('settings_page.agents_create_failed');
		}
	};

	const copy = async (what: 'key' | 'command', text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			copied = what;
			setTimeout(() => {
				if (copied === what) copied = null;
			}, 2000);
		} catch {
			// No clipboard (an insecure origin, a denied permission): the text is in a
			// read-only field the person can select by hand.
		}
	};

	const revoke = async (id: string) => {
		revoking = id;
		const res = await fetch(`/api/v1/users/api_keys/${id}`, { method: 'DELETE' }).catch(
			() => null
		);
		revoking = null;
		if (res?.status === 401) {
			window.location.assign('/account/login?returnTo=/account/settings');
			return;
		}
		await loadKeys();
	};
</script>

{#if enabled}
	<Card.Root data-testid="agent-keys">
		<Card.Header>
			<Card.Title>{$t('settings_page.agents_title')}</Card.Title>
			<Card.Description>{$t('settings_page.agents_description')}</Card.Description>
		</Card.Header>
		<Card.Content class="flex flex-col gap-6">
			{#if created}
				<!-- Shown once. The server keeps only a hash, so there is no second look. -->
				<div
					class="border-border flex flex-col gap-4 rounded-lg border p-4"
					aria-live="polite"
				>
					<div>
						<p class="font-medium">
							{$t('settings_page.agents_created_title', { name: created.name })}
						</p>
						<p class="text-muted-foreground text-sm">
							{$t('settings_page.agents_created_once')}
						</p>
					</div>
					<div class="flex flex-col gap-1.5">
						<Label for="agent-key-value">{$t('settings_page.agents_key_label')}</Label>
						<div class="flex gap-2">
							<Input
								id="agent-key-value"
								class="min-w-0 flex-1 font-mono text-xs"
								readonly
								value={created.key}
								onfocus={(e: FocusEvent) =>
									(e.currentTarget as HTMLInputElement).select()}
							/>
							<Button
								type="button"
								variant="outline"
								aria-label={$t('settings_page.agents_copy_key')}
								onclick={() => created && copy('key', created.key)}
							>
								{#if copied === 'key'}<Check />{:else}<Copy />{/if}
							</Button>
						</div>
					</div>
					{#if command}
						<div class="flex flex-col gap-1.5">
							<Label for="agent-key-command"
								>{$t('settings_page.agents_command_label')}</Label
							>
							<div class="flex gap-2">
								<Input
									id="agent-key-command"
									class="min-w-0 flex-1 font-mono text-xs"
									readonly
									value={command}
									onfocus={(e: FocusEvent) =>
										(e.currentTarget as HTMLInputElement).select()}
								/>
								<Button
									type="button"
									variant="outline"
									aria-label={$t('settings_page.agents_copy_command')}
									onclick={() => copy('command', command)}
								>
									{#if copied === 'command'}<Check />{:else}<Copy />{/if}
								</Button>
							</div>
							<p class="text-muted-foreground text-xs">
								{$t('settings_page.agents_command_hint')}
							</p>
						</div>
					{/if}
					<div>
						<Button type="button" onclick={() => (created = null)}
							>{$t('settings_page.agents_done')}</Button
						>
					</div>
				</div>
			{:else}
				<form class="flex flex-col gap-2 sm:flex-row sm:items-end" onsubmit={createKey}>
					<div class="flex min-w-0 flex-1 flex-col gap-1.5">
						<Label for="agent-key-name">{$t('settings_page.agents_name_label')}</Label>
						<Input
							id="agent-key-name"
							maxlength={60}
							autocomplete="off"
							placeholder={$t('settings_page.agents_name_placeholder')}
							bind:value={name}
							aria-invalid={error !== '' ? 'true' : undefined}
							aria-describedby={error !== '' ? 'agent-key-error' : undefined}
						/>
					</div>
					<Button type="submit" disabled={isCreating || name.trim() === ''}>
						{#if isCreating}
							<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
						{:else}
							<KeyRound aria-hidden="true" />
						{/if}
						{$t('settings_page.agents_create')}
					</Button>
				</form>
				{#if error !== ''}
					<p
						id="agent-key-error"
						class="text-destructive -mt-4 text-sm"
						aria-live="polite"
					>
						{error}
					</p>
				{/if}
			{/if}

			{#if loaded && keys.length > 0}
				<ul class="divide-border border-border divide-y rounded-lg border">
					{#each keys as key (key.id)}
						<li class="flex items-center gap-3 px-4 py-3 text-sm">
							<div class="min-w-0 flex-1">
								<p class="flex flex-wrap items-center gap-2 font-medium">
									<span class="wrap-anywhere">{key.name}</span>
									<code class="text-muted-foreground font-mono text-xs"
										>{key.prefix}…</code
									>
								</p>
								<p class="text-muted-foreground mt-0.5 text-xs">
									{$t('settings_page.agents_created_at', {
										date: formatDate(key.created_at)
									})} ·
									{key.last_used_at
										? $t('settings_page.agents_last_used', {
												date: formatDate(key.last_used_at)
											})
										: $t('settings_page.agents_never_used')}
								</p>
							</div>
							<AlertDialog.Root>
								<!-- type="button": this card has a form of its own, and a bare
								     button inside one submits it. -->
								<AlertDialog.Trigger
									type="button"
									class={buttonVariants({ variant: 'outline', size: 'sm' })}
									disabled={revoking === key.id}
									aria-label={$t('settings_page.agents_revoke_named', {
										name: key.name
									})}
								>
									{$t('settings_page.agents_revoke')}
								</AlertDialog.Trigger>
								<AlertDialog.Content class="max-w-md">
									<AlertDialog.Header>
										<AlertDialog.Title
											>{$t('settings_page.agents_revoke_title', {
												name: key.name
											})}</AlertDialog.Title
										>
										<AlertDialog.Description
											>{$t(
												'settings_page.agents_revoke_body'
											)}</AlertDialog.Description
										>
									</AlertDialog.Header>
									<AlertDialog.Footer>
										<AlertDialog.Cancel>{$t('words.cancel')}</AlertDialog.Cancel
										>
										<AlertDialog.Action
											class={buttonVariants({ variant: 'destructive' })}
											onclick={() => revoke(key.id)}
											>{$t('settings_page.agents_revoke')}</AlertDialog.Action
										>
									</AlertDialog.Footer>
								</AlertDialog.Content>
							</AlertDialog.Root>
						</li>
					{/each}
				</ul>
			{/if}

			<p class="text-muted-foreground text-xs">{$t('settings_page.agents_footnote')}</p>
		</Card.Content>
	</Card.Root>
{/if}
