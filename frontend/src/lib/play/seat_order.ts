// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// The order seats walk through the frog files. Kept out of avatars.svelte.ts because it
// is plain data in, data out: nothing here is reactive.

/**
 * Every frog once, laid out so that a run of consecutive seats as long as the pose count
 * has no pose twice, and a run as long as the whole set has no frog twice. Files that do
 * not form a full frog-<colour>-<pose> grid are shuffled instead.
 */
export function seatOrder(byPath: Record<string, string>, seed: number): string[] {
	const random = mulberry32(seed);
	// By path, so the order does not depend on how the bundler happened to list the files.
	const urls = Object.keys(byPath)
		.sort()
		.map((path) => byPath[path]);
	const grid = new Map<string, Map<string, string>>();
	for (const [path, url] of Object.entries(byPath)) {
		const m = /frog-(\d+)-(\d+)\.webp$/.exec(path);
		if (!m) return shuffle(urls, random);
		const [, colour, pose] = m;
		if (!grid.has(pose)) grid.set(pose, new Map());
		grid.get(pose)!.set(colour, url);
	}
	const colours = [...new Set([...grid.values()].flatMap((c) => [...c.keys()]))].sort();
	// A pose missing a colour would leave a hole in the laps; shuffling everything at
	// least still never repeats a frog until all have been handed out.
	if ([...grid.values()].some((c) => c.size !== colours.length)) {
		return shuffle(urls, random);
	}
	const poses = shuffle([...grid.keys()].sort(), random);
	const offsets = poses.map(() => Math.floor(random() * colours.length));
	const order: string[] = [];
	for (let lap = 0; lap < colours.length; lap++) {
		poses.forEach((pose, i) => {
			order.push(grid.get(pose)!.get(colours[(lap + offsets[i]) % colours.length])!);
		});
	}
	return order;
}

/** A small seeded generator, so the order is the same on every device. */
function mulberry32(seed: number) {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function shuffle<T>(items: T[], random: () => number): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}
