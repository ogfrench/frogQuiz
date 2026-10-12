<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors
SPDX-License-Identifier: MPL-2.0
-->
<!-- Pick your frog (François, 12 Oct, option C): a colour row and a strip of that colour's
     25 frogs, right on My Account. A tap saves at once and says so, with Undo; "Surprise me"
     picks any of the 150. The colour is shown by a small frog of it, so the page stays zinc. -->
<script lang="ts">
	import { getLocalization } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import Shuffle from '@lucide/svelte/icons/shuffle';
	import { COLOURS, POSES, defaultFrog, frogUrl, me, randomFrog } from '$lib/account_frog.svelte';

	const { t } = getLocalization();
	let { username }: { username: string } = $props();

	const current = $derived(me.frog ?? defaultFrog(username));
	// The colour whose frogs the strip shows: the current frog's, until the person looks at another.
	let looking = $state<number | null>(null);
	const colour = $derived(looking ?? Number(current.split('-')[0]));

	let status = $state<'idle' | 'saved' | 'failed'>('idle');
	let before = $state<string | null>(null);

	const save = async (frog: string | null) => {
		const previous = me.frog;
		me.frog = frog;
		const res = await fetch('/api/v1/users/me/frog', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ frog })
		}).catch(() => null);
		if (res?.ok) return true;
		me.frog = previous;
		status = 'failed';
		return false;
	};

	const pick = async (frog: string) => {
		if (frog === current) return;
		before = me.frog;
		looking = null;
		if (await save(frog)) status = 'saved';
	};
	const undo = async () => {
		looking = null;
		if (await save(before)) status = 'idle';
	};
</script>

<div class="grid min-w-0 gap-3 basis-full">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<p id="frog-label" class="text-sm font-medium">{$t('settings_page.frog_title')}</p>
		<Button variant="outline" size="sm" onclick={() => pick(randomFrog(current))}>
			<Shuffle />
			{$t('settings_page.frog_surprise')}
		</Button>
	</div>

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
				class="bg-muted snap-start shrink-0 rounded-full {key === current
					? 'ring-foreground ring-2 ring-offset-2 ring-offset-card'
					: 'hover:ring-border hover:ring-2'}"
				aria-pressed={key === current}
				aria-label={$t('settings_page.frog_use', { n: Number(p) })}
				onclick={() => pick(key)}
			>
				<img src={frogUrl(key)} alt="" class="size-14 object-contain p-[9%]" />
			</button>
		{/each}
	</div>

	<p role="status" class="text-muted-foreground min-h-5 text-sm">
		{#if status === 'saved'}
			{$t('settings_page.frog_saved')}
			<Button variant="link" class="h-auto p-0 text-sm" onclick={undo}>
				{$t('settings_page.frog_undo')}
			</Button>
		{:else if status === 'failed'}
			<span class="text-destructive">{$t('settings_page.frog_failed')}</span>
		{/if}
	</p>
</div>
