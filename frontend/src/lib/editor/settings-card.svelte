<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import type { EditorData } from '$lib/quiz_types';
	import { getLocalization } from '$lib/i18n';
	import Spinner from '$lib/Spinner.svelte';
	import { Button } from '$lib/components/ui/button';
	import Globe from '@lucide/svelte/icons/globe';
	import Lock from '@lucide/svelte/icons/lock';
	import X from '@lucide/svelte/icons/x';

	const { t } = getLocalization();

	let uppyOpen = $state(false);
	let bg_uppy_open = $state(false);

	interface Props {
		edit_id: string;
		data: EditorData;
	}

	let { edit_id = $bindable(), data = $bindable() }: Props = $props();

	let custom_bg_color = $state(Boolean(data.background_color));

	$effect(() => {
		data.background_color = custom_bg_color ? data.background_color : undefined;
	});
</script>

<div class="mx-auto w-full max-w-3xl">
	<div class="border-border bg-card flex flex-col gap-8 rounded-xl border p-6 shadow-sm">
		<div class="flex flex-col gap-2">
			<span class="text-muted-foreground text-sm font-medium">{$t('words.title')}</span>
			{#await import('$lib/inline-editor.svelte')}
				<Spinner my_20={false} />
			{:then c}
				<div class="[&_[contenteditable]]:w-full">
					<c.default bind:text={data.title} />
				</div>
			{/await}
		</div>

		<label class="flex flex-col gap-2">
			<span class="text-muted-foreground text-sm font-medium">{$t('words.description')}</span>
			<textarea
				bind:value={data.description}
				class="border-input bg-background focus-visible:ring-ring h-24 w-full resize-none rounded-lg border p-3 focus-visible:ring-2 focus-visible:outline-none"
			></textarea>
		</label>

		<div class="flex flex-col gap-2">
			<span class="text-muted-foreground text-sm font-medium">{$t('words.cover_image')}</span>
			{#if data.cover_image != undefined && data.cover_image !== ''}
				<div class="relative w-fit">
					<img
						src="/api/v1/storage/download/{data.cover_image}"
						alt=""
						class="max-h-56 w-auto rounded-lg"
					/>
					<button
						type="button"
						class="border-border bg-card text-muted-foreground hover:text-destructive focus-visible:ring-ring absolute -top-2 -right-2 rounded-full border p-1 shadow-sm transition focus-visible:ring-2 focus-visible:outline-none"
						title={$t('words.delete')}
						aria-label={$t('words.delete')}
						onclick={() => {
							data.cover_image = null;
						}}
					>
						<X class="size-4" />
					</button>
				</div>
			{:else}
				{#await import('$lib/editor/uploader.svelte')}
					<Spinner my_20={false} />
				{:then c}
					<c.default bind:modalOpen={uppyOpen} {data} video_upload={false} />
				{/await}
			{/if}
		</div>

		<div class="flex flex-col gap-2">
			<span class="text-muted-foreground text-sm font-medium">{$t('words.visibility')}</span>
			<Button
				type="button"
				variant="outline"
				class="w-fit"
				onclick={() => {
					data.public = !data.public;
				}}
			>
				{#if data.public}
					<Globe />
					{$t('words.public')}
				{:else}
					<Lock />
					{$t('words.private')}
				{/if}
			</Button>
		</div>

		<div class="flex flex-col gap-2">
			<span class="text-muted-foreground text-sm font-medium">{$t('editor.bg_color')}</span>
			<div class="flex items-center gap-3">
				<!-- The label used to be a sibling of the checkbox rather than its parent, so
				     the tap target was the 20px box alone and the words beside it did
				     nothing. Wrapping makes the whole row one target. -->
				<label class="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
					<input
						type="checkbox"
						id="custom-bg-color"
						bind:checked={custom_bg_color}
						class="accent-primary size-5"
					/>
					{$t('editor.bg_color_custom')}
				</label>
				<input
					type="color"
					class="border-input min-h-11 w-16 cursor-pointer rounded-md border p-1 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={!custom_bg_color}
					bind:value={data.background_color}
				/>
			</div>
		</div>

		<div class="flex flex-col gap-2">
			<span class="text-muted-foreground text-sm font-medium">{$t('editor.bg_image')}</span>
			{#if data.background_image}
				<div class="relative w-fit">
					<img
						src="/api/v1/storage/download/{data.background_image}"
						alt=""
						class="max-h-40 w-auto rounded-lg"
					/>
					<button
						type="button"
						class="border-border bg-card text-muted-foreground hover:text-destructive focus-visible:ring-ring absolute -top-2 -right-2 rounded-full border p-1 shadow-sm transition focus-visible:ring-2 focus-visible:outline-none"
						title={$t('words.delete')}
						aria-label={$t('words.delete')}
						onclick={() => {
							data.background_image = undefined;
						}}
					>
						<X class="size-4" />
					</button>
				</div>
			{:else}
				{#await import('$lib/editor/uploader.svelte')}
					<Spinner my_20={false} />
				{:then c}
					<c.default
						bind:modalOpen={bg_uppy_open}
						{data}
						selected_question={-1}
						video_upload={false}
					/>
				{/await}
			{/if}
		</div>
	</div>
</div>
