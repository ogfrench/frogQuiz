<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script module lang="ts">
	// One context and one decoded track for the whole game. This component unmounts at every
	// question's answers, and each mount made its own AudioContext and decoded the 1.4 MB
	// track again. A context the host's first press unlocked also stays unlocked.
	let shared_ctx: AudioContext | undefined;
	let shared_tracks: Promise<AudioBuffer[]> | undefined;
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { getLocalization } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import Volume2 from '@lucide/svelte/icons/volume-2';
	import VolumeX from '@lucide/svelte/icons/volume-x';
	import Play from '@lucide/svelte/icons/play';
	import Track from '$lib/assets/music/kit/question.wav';
	import FastTrack from '$lib/assets/music/kit/question-fast.wav';
	import { music } from '$lib/play/music_pref.svelte';
	import { sfx } from '$lib/play/sfx';

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
	// The source's own fade, under `gain` (the volume): the switch to the fast loop and the
	// end of the question each fade one source out without touching the volume.
	let fade: GainNode | undefined;
	let buffers: AudioBuffer[] | undefined;
	let fast = false;
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

	// The clock reaching zero, the one moment this component sees that nothing else does.
	$effect(() => {
		if (remaining === 0 && total > 0) sfx('timesup');
	});
	const playing = $derived(music.on && remaining > 0 && total > 0);

	// The last seconds play the same loop rendered at 1.5x the tempo (kit C, 180 BPM). Played
	// faster, the loop itself would also go up a fifth in pitch, which music cannot take the
	// way the old tick could.
	const LAST_SECONDS = 5;
	const frame = () => {
		if (!source || !ctx) return;
		const since = (performance.now() - last_stamp) / 1000;
		const left = Math.max(last_remaining - Math.min(since, 1), 0);
		if (!fast && left <= LAST_SECONDS) {
			fast = true;
			stop_source();
			play(1);
		}
		raf = requestAnimationFrame(frame);
	};
	const play = (which: number) => {
		if (!ctx || !gain || !buffers) return;
		fade = ctx.createGain();
		source = ctx.createBufferSource();
		source.buffer = buffers[which];
		source.loop = true;
		source.connect(fade).connect(gain);
		source.start();
	};
	// A hard cut mid-note sounds like a glitch; a short fade does not.
	const stop_source = () => {
		const s = source;
		const f = fade;
		source = undefined;
		if (!s || !f || !ctx) return;
		f.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
		setTimeout(() => {
			try {
				s.stop();
			} catch {
				/* already stopped */
			}
		}, 400);
	};

	const begin = async () => {
		try {
			const context = (ctx ??= shared_ctx ??= new AudioContext());
			if (!buffers) {
				shared_tracks ??= Promise.all(
					[Track, FastTrack].map((url) =>
						fetch(url)
							.then((r) => r.arrayBuffer())
							.then((b) => context.decodeAudioData(b))
					)
				);
				try {
					buffers = await shared_tracks;
				} catch (e) {
					// Not cached as a failure: the next question tries again.
					shared_tracks = undefined;
					throw e;
				}
			}
			await ctx.resume();
			if (ctx.state !== 'running') throw new Error('suspended');
			if (!alive || !playing || source) return;
			gain ??= ctx.createGain();
			gain.gain.value = music.volume / 100;
			gain.connect(ctx.destination);
			fast = false;
			play(0);
			blocked = false;
			frame();
		} catch {
			// No gesture yet (a reload lands here), or the file would not load: say "press
			// to play" instead of showing a speaker that is not sounding.
			blocked = true;
		}
	};

	const end = () => {
		cancelAnimationFrame(raf);
		stop_source();
	};

	$effect(() => {
		if (gain) gain.gain.value = music.volume / 100;
	});

	$effect(() => {
		if (playing) begin();
		else end();
	});

	// The context is shared and stays open for the next question; only this question's
	// sound stops.
	onMount(() => () => {
		alive = false;
		end();
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
