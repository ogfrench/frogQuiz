<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { onMount } from 'svelte';
	import { getLocalization } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import Volume2 from '@lucide/svelte/icons/volume-2';
	import VolumeX from '@lucide/svelte/icons/volume-x';
	import Play from '@lucide/svelte/icons/play';
	import Track from '$lib/assets/music/podium/podium-loop.mp3';
	import { music } from '$lib/play/music_pref.svelte';

	const { t } = getLocalization();

	interface Props {
		/** When to start, in ms from the podium appearing: the winner's landing. */
		delay_ms: number;
	}

	let { delay_ms }: Props = $props();

	let blocked = $state(false);

	let audio: HTMLAudioElement | undefined;
	let started = false;

	// The whole prelude, looped: it fades in, ends on a faded final chord and a second of
	// silence, so the repeat swells back in rather than landing on a seam. The podium has no
	// timer, and the host talks over it for as long as they like.
	const start = async () => {
		if (!music.on) return;
		if (!audio) {
			audio = new Audio(Track);
			audio.loop = true;
		}
		audio.volume = music.volume / 100;
		try {
			await audio.play();
			started = true;
			blocked = false;
		} catch (e) {
			// Muting while play() is still pending rejects it with AbortError: that is not a block.
			if (e instanceof DOMException && e.name === 'AbortError') return;
			blocked = true;
		}
	};

	onMount(() => {
		const timer = setTimeout(start, delay_ms);
		return () => {
			clearTimeout(timer);
			if (!audio) return;
			// A cut mid-chord sounds like a bug; ten short steps down is leaving the room.
			const a = audio;
			audio = undefined;
			const step = a.volume / 10;
			const fade = setInterval(() => {
				a.volume = Math.max(0, a.volume - step);
				if (a.volume <= 0.01) {
					clearInterval(fade);
					a.pause();
				}
			}, 40);
		};
	});

	// Muted from the lobby, the question, or here: the same switch. Reacting to it rather
	// than only to this screen's own button is what keeps the whole game quiet.
	$effect(() => {
		// Read first: with no audio yet this still has to subscribe to both.
		const on = music.on;
		const volume = music.volume;
		if (!audio) return;
		audio.volume = volume / 100;
		if (!on) audio.pause();
		// Switched back on after the piece began: resume rather than restart it.
		else if (started) audio.play().catch(() => (blocked = true));
	});

	const toggle = () => {
		if (blocked) {
			music.set_on(true);
			start();
		} else {
			music.toggle();
			if (music.on && !started) start();
		}
	};
</script>

<div
	class="border-border/70 bg-card/90 fixed bottom-4 left-4 z-50 rounded-full border p-1.5 shadow-sm backdrop-blur"
>
	<Button
		variant="ghost"
		size="icon"
		class="rounded-full"
		aria-label={music.on && !blocked ? $t('play_page.music_off') : $t('play_page.music_on')}
		title={music.on && !blocked ? $t('play_page.music_off') : $t('play_page.music_on')}
		onclick={toggle}
	>
		{#if blocked}
			<Play />
		{:else if music.on}
			<Volume2 />
		{:else}
			<VolumeX />
		{/if}
	</Button>
</div>
