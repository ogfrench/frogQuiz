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
	import Track from '$lib/assets/music/question/tick-loop.wav';
	import { tick_rate } from './tick_rate';
	import { music } from '$lib/play/music_pref.svelte';

	const { t } = getLocalization();

	interface Props {
		/** Seconds left, as the server's timer reports it: whole numbers, once a second. */
		remaining: number;
		/** The question's full time in seconds. */
		total: number;
	}

	let { remaining, total }: Props = $props();

	// The game's one mute: `music.on` is shared with the lobby and the podium, so muting
	// anywhere mutes everywhere, live.
	let blocked = $state(false);

	let ctx: AudioContext | undefined;
	let gain: GainNode | undefined;
	let source: AudioBufferSourceNode | undefined;
	let buffer: AudioBuffer | undefined;
	let raf = 0;
	// Cleared on unmount: a begin() still awaiting fetch, decode or resume must not start a
	// source for a question that has already ended.
	let alive = true;

	// The server reports whole seconds, so the rate would move in once-a-second steps.
	// Between reports the remaining time is extrapolated from the clock, but never past the
	// next whole second: a late report must not be outrun.
	let last_remaining = remaining;
	let last_stamp = performance.now();
	$effect(() => {
		last_remaining = remaining;
		last_stamp = performance.now();
	});

	const playing = $derived(music.on && remaining > 0 && total > 0);

	const frame = () => {
		if (!source || !ctx) return;
		const since = (performance.now() - last_stamp) / 1000;
		const left = Math.max(last_remaining - Math.min(since, 1), 0);
		source.playbackRate.setTargetAtTime(tick_rate(1 - left / total), ctx.currentTime, 0.04);
		raf = requestAnimationFrame(frame);
	};

	const begin = async () => {
		try {
			ctx ??= new AudioContext();
			if (!buffer) {
				buffer = await ctx.decodeAudioData(await (await fetch(Track)).arrayBuffer());
			}
			await ctx.resume();
			if (ctx.state !== 'running') throw new Error('suspended');
			if (!alive || !playing || source) return;
			gain = ctx.createGain();
			gain.gain.value = music.volume / 100;
			source = ctx.createBufferSource();
			source.buffer = buffer;
			source.loop = true;
			source.connect(gain).connect(ctx.destination);
			source.start();
			blocked = false;
			frame();
		} catch {
			// No gesture yet (a reload lands here), or the file would not load: say "press
			// to play" instead of showing a speaker that is not sounding.
			blocked = true;
		}
	};

	// A hard cut mid-tick sounds like a glitch; a short fade is the end of the question.
	const end = () => {
		cancelAnimationFrame(raf);
		const s = source;
		const g = gain;
		source = undefined;
		if (!s || !g || !ctx) return;
		g.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
		setTimeout(() => {
			try {
				s.stop();
			} catch {
				/* already stopped */
			}
		}, 400);
	};

	$effect(() => {
		if (gain) gain.gain.value = music.volume / 100;
	});

	$effect(() => {
		if (playing) begin();
		else end();
	});

	onMount(() => () => {
		alive = false;
		end();
		setTimeout(() => ctx?.close(), 500);
	});

	const toggle = () => {
		music.set_on(blocked ? true : !music.on);
		if (music.on) begin();
	};
</script>

<!-- Same corner as the lobby's control, for the same reason: one place to look. -->
<div
	class="border-border/70 bg-card/90 fixed bottom-4 left-4 z-30 rounded-full border p-1.5 shadow-sm backdrop-blur"
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
