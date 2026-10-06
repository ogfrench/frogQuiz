<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { browser } from '$app/environment';
	import { fade } from 'svelte/transition';
	import { thumbHashToDataURL } from 'thumbhash';
	import { getLocalization } from '$lib/i18n';
	import * as Dialog from '$lib/components/ui/dialog/index.js';

	const { t } = getLocalization();

	interface Props {
		src: string;
		css_classes?: string;
		added_thumbhash_classes?: string;
		muted?: boolean;
		allow_fullscreen?: boolean;
	}

	let {
		src,
		css_classes = 'max-h-64 h-auto w-auto',
		added_thumbhash_classes = 'h-full',
		muted = true,
		allow_fullscreen = true
	}: Props = $props();
	let type: 'img' | 'video' | undefined = $state(undefined);

	let img_data = $state<{ data: string; alt_text: string }>();
	let thumbhash_data: string = $state();

	function base64ToBytes(base64: string): Uint8Array {
		const binString = atob(base64);
		return Uint8Array.from(binString, (m) => m.codePointAt(0));
	}

	const get_media = async (_: string) => {
		if (!browser) {
			return;
		}
		const res = await fetch(`/api/v1/storage/info/${src}`);
		const fileType = res.headers.get('Content-Type');
		if (fileType.includes('video')) {
			type = 'video';
		} else {
			type = 'img';
			// The server leaves both headers out when it has nothing to send, and atob(null)
			// does not throw: it decodes the string "null". That is why every image without
			// alt text -- which is every image, since alt text can only be set on the hidden
			// media library -- was announced as "��e".
			const thumbhash = res.headers.get('x-thumbhash');
			if (thumbhash) thumbhash_data = thumbHashToDataURL(base64ToBytes(thumbhash));
			const alt = res.headers.get('X-Alt-Text');
			const data = await fetch(`/api/v1/storage/download/${src}`);
			img_data = {
				data: URL.createObjectURL(await data.blob()),
				alt_text: alt ? new TextDecoder().decode(base64ToBytes(alt)) : ''
			};
			thumbhash_data = undefined;
		}
	};
	let media = $derived(get_media(src));

	let fullscreen_open = $state(false);

	const open_fullscreen = () => {
		if (!allow_fullscreen) {
			return;
		}
		fullscreen_open = true;
	};
</script>

{#await media}
	<img src={thumbhash_data} alt="" class={`${css_classes} ${added_thumbhash_classes}`} />
{:then}
	{#if type === 'img'}
		<img
			in:fade|global={{ duration: 300 }}
			src={img_data.data}
			alt={img_data.alt_text}
			class="{css_classes} {allow_fullscreen ? 'cursor-zoom-in' : ''}"
			onclick={() => open_fullscreen()}
		/>
	{:else if type === 'video'}
		<video
			class={css_classes}
			disablepictureinpicture
			x-webkit-airplay="deny"
			controls
			autoplay
			loop
			{muted}
			preload="metadata"
		>
			<source src="/api/v1/storage/download/{src}" />
		</video>
	{:else}
		<p>Unknown media type</p>
	{/if}
{/await}

<!-- The shadcn Dialog: Escape, a click anywhere, or Enter closes it. It was a
     `w-screen h-screen` div with no Escape, and a `fle` typo where `flex` was meant, so
     the image sat at the top of the screen instead of in the middle. -->
<Dialog.Root bind:open={fullscreen_open}>
	<Dialog.Content
		showCloseButton={false}
		class="grid h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-none place-items-center bg-transparent p-0 ring-0 sm:max-w-none"
	>
		<Dialog.Title class="sr-only">{img_data?.alt_text || $t('words.image')}</Dialog.Title>
		<Dialog.Close
			aria-label={$t('words.close')}
			class="grid size-full cursor-zoom-out place-items-center outline-none"
		>
			{#if img_data}
				<img
					src={img_data.data}
					alt={img_data.alt_text}
					class="max-h-full max-w-full rounded-sm object-contain"
				/>
			{/if}
		</Dialog.Close>
	</Dialog.Content>
</Dialog.Root>
