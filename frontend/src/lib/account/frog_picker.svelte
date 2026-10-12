<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors
SPDX-License-Identifier: MPL-2.0
-->
<!-- Pick your frog (François, 12 Oct, option C): a colour row and a strip of that colour's
     25 frogs on My Account, behind "Edit picture" so the page opens quiet. A tap only tries a
     frog (the big picture above shows it); Save keeps it, Cancel drops it. "Surprise me"
     tries any of the 150. The colour is shown by a small frog of it, so the page stays zinc. -->
<script lang="ts">
	import { getLocalization } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import Shuffle from '@lucide/svelte/icons/shuffle';
	import Pencil from '@lucide/svelte/icons/pencil';
	import { COLOURS, POSES, defaultFrog, frogUrl, me, randomFrog } from '$lib/account_frog.svelte';

	const { t } = getLocalization();
	let { username }: { username: string } = $props();

	// What is kept: the pick, else the username's frog.
	const saved = $derived(me.frog ?? defaultFrog(username));

	let editing = $state(false);
	// The frog being tried. Null until one is tapped; the big picture follows it.
	let draft = $state<string | null>(null);
	const shown = $derived(draft ?? saved);
	// The colour whose frogs the strip shows: the shown frog's, until the person looks at another.
	let looking = $state<number | null>(null);
	const colour = $derived(looking ?? Number(shown.split('-')[0]));

	let status = $state<'idle' | 'saved' | 'failed'>('idle');
	let saving = $state(false);

	const open = () => {
		status = 'idle';
		editing = true;
	};
	const close = () => {
		editing = false;
		draft = null;
		looking = null;
		me.preview = null;
	};
	const tryFrog = (frog: string) => {
		draft = frog;
		me.preview = frog;
	};

	const save = async () => {
		if (!draft) return close();
		saving = true;
		const res = await fetch('/api/v1/users/me/frog', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ frog: draft })
		}).catch(() => null);
		saving = false;
		if (res?.ok) {
			me.frog = draft;
			status = 'saved';
			close();
		} else {
			status = 'failed';
		}
	};
</script>

<div class="grid min-w-0 basis-full gap-3">
	<div class="flex flex-wrap items-center justify-between gap-2">
		{#if editing}
			<p id="frog-label" class="text-sm font-medium">{$t('settings_page.frog_title')}</p>
			<div class="flex flex-wrap gap-2">
				<Button variant="outline" size="sm" onclick={() => tryFrog(randomFrog(shown))}>
					<Shuffle />
					{$t('settings_page.frog_surprise')}
				</Button>
				<Button variant="ghost" size="sm" onclick={close}>{$t('words.cancel')}</Button>
				<Button size="sm" disabled={saving || !draft || draft === saved} onclick={save}>
					{$t('words.save')}
				</Button>
			</div>
		{:else}
			<Button variant="outline" size="sm" aria-expanded="false" onclick={open}>
				<Pencil />
				{$t('settings_page.frog_edit')}
			</Button>
		{/if}
	</div>

	{#if editing}
		<div role="group" aria-label={$t('settings_page.frog_colours')} class="flex flex-wrap gap-1">
			{#each COLOURS as c (c)}
				<button
					type="button"
					class="hover:bg-muted flex size-11 items-center justify-center rounded-full {colour === c
						? 'bg-muted ring-foreground ring-2'
						: ''}"
					aria-pressed={colour === c}
					aria-label={$t('settings_page.frog_colour', { n: c + 1 })}
					onclick={() => (looking = c)}
				>
					<img src={frogUrl(`${c}-01`)} alt="" class="size-8 object-contain" />
				</button>
			{/each}
		</div>

		<div
			role="group"
			aria-labelledby="frog-label"
			class="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2"
		>
			{#each POSES as p (p)}
				{@const key = `${colour}-${p}`}
				<button
					type="button"
					class="bg-muted ring-offset-card shrink-0 snap-start rounded-full {key === shown
						? 'ring-foreground ring-2 ring-offset-2'
						: 'hover:ring-border hover:ring-2'}"
					aria-pressed={key === shown}
					aria-label={$t('settings_page.frog_use', { n: Number(p) })}
					onclick={() => tryFrog(key)}
				>
					<img src={frogUrl(key)} alt="" class="size-14 object-contain p-[9%]" />
				</button>
			{/each}
		</div>
	{/if}

	<p role="status" class="text-muted-foreground min-h-5 text-sm">
		{#if status === 'saved'}
			{$t('settings_page.frog_saved')}
		{:else if status === 'failed'}
			<span class="text-destructive">{$t('settings_page.frog_failed')}</span>
		{/if}
	</p>
</div>
