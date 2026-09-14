<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)

SPDX-License-Identifier: MPL-2.0
-->
<script lang="ts">
	import { Dashboard as SvelteDashboard } from '@uppy/svelte';
	import Uppy from '@uppy/core';
	import DropTarget from '@uppy/drop-target';
	import XHRUpload from '@uppy/xhr-upload';
	import ImageEditor from '@uppy/image-editor';
	import Dashboard from '@uppy/dashboard';
	import Compressor from '@uppy/compressor';
	import { fade } from 'svelte/transition';
	import BrownButton from '$lib/components/buttons/brown.svelte';
	import { Button } from '$lib/components/ui/button';
	import ImagePlus from '@lucide/svelte/icons/image-plus';

	// CSS imports
	import '@uppy/core/dist/style.css';
	import '@uppy/dashboard/dist/style.css';
	import '@uppy/drop-target/dist/style.css';
	import '@uppy/image-editor/dist/style.css';
	import type { EditorData } from '../quiz_types';
	import { getLocalization } from '$lib/i18n';
	import { onMount } from 'svelte';
	import Library from '$lib/editor/uploader/Library.svelte';
	import Pixabay from '$lib/editor/uploader/Pixabay.svelte';

	const { t } = getLocalization();
	let {
		modalOpen = $bindable(),
		data,
		selected_question,
		video_upload = false,
		library_enabled = true
	}: {
		modalOpen: boolean;
		data: EditorData;
		selected_question?: number;
		video_upload: boolean;
		library_enabled?: boolean;
	} = $props();

	// eslint-disable-next-line no-undef
	let video_popup: undefined | WindowProxy = $state(undefined);

	let selected_type: AvailableUploadTypes | null = $state(null);

	// eslint-disable-next-line no-unused-vars
	enum AvailableUploadTypes {
		// eslint-disable-next-line no-unused-vars
		Image,
		// eslint-disable-next-line no-unused-vars
		Video,
		// eslint-disable-next-line no-unused-vars
		Library,
		// eslint-disable-next-line no-unused-vars
		Pixabay
	}

	const uppy = new Uppy()
		.use(DropTarget, {
			target: document.body
		})
		.use(Dashboard)
		.use(ImageEditor, {
			target: Dashboard,
			quality: 0.8
		})
		.use(Compressor, {
			quality: 0.6
		})
		.use(XHRUpload, {
			endpoint: `/api/v1/storage/`
		});
	const properties = {
		inline: true,
		restrictions: {
			maxFileSize: 10_490_000,
			maxNumberOfFiles: 1,
			allowedFileTypes: ['image/*']
			// allowedFileTypes: ['.gif', '.jpg', '.jpeg', '.png', '.svg', '.webp']
		}
	};
	let image_id: string;
	uppy.on('upload-success', (file, response) => {
		image_id = response.body.id;
	});
	uppy.on('complete', (_) => {
		if (selected_question === undefined) {
			data.cover_image = image_id;
		} else if (selected_question === -1) {
			data.background_image = image_id;
		} else {
			data.questions[selected_question].image = image_id;
		}

		modalOpen = false;
		selected_type = null;
	});

	onMount(() => {
		window.addEventListener('storage', (e) => {
			if (e.key !== 'video_upload_id') {
				return;
			}
			localStorage.removeItem('video_upload_id');
			data.questions[selected_question].image = e.newValue;
			selected_type = null;
		});
	});

	const upload_video = async () => {
		video_popup = window.open(
			'/edit/videos',
			'_blank',
			'popup=true,toolbar=false,menubar=false,location=false,'
		);
		video_popup.addEventListener('beforeunload', () => {
			video_popup = undefined;
		});
	};

	const handle_on_click = (e: Event) => {
		if (e.target === e.currentTarget) {
			modalOpen = false;
			selected_type = null;
		}
	};
	onMount(() => {
		window.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				modalOpen = false;
				selected_type = null;
			}
		});
	});
</script>

{#if modalOpen}
	<div
		class="fixed inset-0 z-20 flex overflow-y-auto bg-black/50 p-4"
		onclick={handle_on_click}
		tabindex="0"
		role="button"
		aria-label="Close modal"
		onkeydown={(e) => (e.key === 'Enter' || e.key === ' ' ? handle_on_click(e) : null)}
		transition:fade={{ duration: 100 }}
	>
		{#if selected_type === null}
			<div
				class="border-border bg-card m-auto w-full max-w-lg rounded-xl border p-6 shadow-xl"
			>
				<h1 class="mb-5 text-center text-xl font-semibold">
					{$t('uploader.select_upload_type')}
				</h1>
				<div class="flex flex-wrap gap-3 sm:flex-nowrap">
					<div class="w-full">
						<BrownButton
							onclick={() => {
								selected_type = AvailableUploadTypes.Image;
							}}
							>{$t('words.image')}
						</BrownButton>
					</div>
					<div class="w-full">
						<BrownButton
							disabled={!video_upload}
							onclick={() => {
								selected_type = AvailableUploadTypes.Video;
							}}
							>{$t('words.video')}
						</BrownButton>
					</div>
					{#if library_enabled}
						<div class="w-full">
							<BrownButton
								onclick={() => {
									selected_type = AvailableUploadTypes.Library;
								}}
								>{$t('words.library')}
							</BrownButton>
						</div>
					{/if}
					<div class="w-full">
						<BrownButton
							onclick={() => {
								selected_type = AvailableUploadTypes.Pixabay;
							}}
							>Pixabay
						</BrownButton>
					</div>
				</div>
			</div>
		{:else if selected_type === AvailableUploadTypes.Image}
			<div class="m-auto w-full max-w-3xl" transition:fade={{ duration: 100 }}>
				<div>
					<SvelteDashboard {uppy} width="100%" {properties} />
				</div>
			</div>
		{:else if selected_type === AvailableUploadTypes.Video}
			<div
				class="border-border bg-card m-auto w-full max-w-lg rounded-xl border p-6 shadow-xl"
				transition:fade={{ duration: 100 }}
			>
				<h1 class="text-3xl text-center mb-4">{$t('uploader.upload_a_video')}</h1>
				{#if video_popup}
					<p class="text-center">
						{$t('uploader.upload_video_popup_notice')}
					</p>
				{:else}
					<BrownButton onclick={upload_video} type="button"
						>{$t('uploader.upload_video')}</BrownButton
					>
				{/if}
			</div>
		{:else if selected_type === AvailableUploadTypes.Library}
			<div>
				<Library bind:data {selected_question} bind:modalOpen />
			</div>
		{:else if selected_type === AvailableUploadTypes.Pixabay}
			<div>
				<Pixabay bind:data {selected_question} bind:modalOpen />
			</div>
		{/if}
	</div>
{/if}
<!-- Was a hand-rolled button: label set in italic for no reason, no gap between
     that label and its icon so the two collided, pt-10 of hardcoded dead space
     above it, an arbitrary w-1/2, a raw Heroicon path, and gray-500/gray-300
     borders that ignore the theme. It is a shadcn outline button now, full width of
     whatever field it sits in, with the Lucide icon and a real gap. -->
<div class="w-full" transition:fade>
	<Button
		type="button"
		variant="outline"
		class="w-full gap-2"
		onclick={() => {
			modalOpen = true;
		}}
	>
		<ImagePlus class="size-4 shrink-0" />
		{$t('uploader.add_image')}
	</Button>
</div>
