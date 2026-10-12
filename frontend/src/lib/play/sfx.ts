// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { music } from '$lib/play/music_pref.svelte';

/**
 * The short sounds of a game (kit C5, assets/music/kit/sfx): one shot each, played on the
 * game's one context so a first press unlocks every later sound. They follow the same mute
 * and volume as the lobby, the question loop and the podium: `music`.
 */
export type Sfx =
	| 'getready'
	| 'timesup'
	| 'reveal'
	| 'scoreboard'
	| 'place3'
	| 'place2'
	| 'place1'
	| 'locked'
	| 'correct'
	| 'incorrect';

const files = import.meta.glob('../assets/music/kit/sfx/*.wav', {
	eager: true,
	query: '?url',
	import: 'default'
}) as Record<string, string>;

let ctx: AudioContext | undefined;
const buffers = new Map<Sfx, Promise<AudioBuffer>>();

const load = (name: Sfx, context: AudioContext) => {
	let loaded = buffers.get(name);
	if (!loaded) {
		const url = files[`../assets/music/kit/sfx/${name}.wav`];
		loaded = fetch(url)
			.then((r) => r.arrayBuffer())
			.then((b) => context.decodeAudioData(b));
		// A failed load is tried again next time, not remembered.
		loaded.catch(() => buffers.delete(name));
		buffers.set(name, loaded);
	}
	return loaded;
};

/** Plays one sound. Never throws: a sound that cannot play (no gesture yet, no file) is silence. */
export async function sfx(name: Sfx) {
	if (!music.on || typeof AudioContext === 'undefined') return;
	try {
		const context = (ctx ??= new AudioContext());
		const buffer = await load(name, context);
		await context.resume();
		if (context.state !== 'running') return;
		const gain = context.createGain();
		gain.gain.value = music.volume / 100;
		const source = context.createBufferSource();
		source.buffer = buffer;
		source.connect(gain).connect(context.destination);
		source.start();
	} catch {
		/* silence */
	}
}
