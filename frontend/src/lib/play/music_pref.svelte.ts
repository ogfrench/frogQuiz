// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

/**
 * The host's one music choice for the whole game: lobby, questions, podium. It is one
 * reactive object rather than a value each screen reads when it opens, so muting on any
 * screen is a change every other screen sees, and it survives the screen changing, a
 * reload and a second tab. Screens must read `music.on` and `music.volume`, never keep a
 * copy of their own.
 */
const STORE_KEY = 'frogquiz_music';
export const DEFAULT_VOLUME = 40;

const load = (): { on: boolean; volume: number } => {
	try {
		const raw = localStorage.getItem(STORE_KEY);
		const stored = raw ? JSON.parse(raw) : null;
		return {
			on: stored?.on ?? true,
			volume: typeof stored?.volume === 'number' ? stored.volume : DEFAULT_VOLUME
		};
	} catch {
		return { on: true, volume: DEFAULT_VOLUME };
	}
};

class MusicPref {
	on = $state(true);
	volume = $state(DEFAULT_VOLUME);

	constructor() {
		this.apply(load());
		// Another tab on the same host machine changed it.
		if (typeof window !== 'undefined') {
			window.addEventListener('storage', (e) => {
				if (e.key === STORE_KEY) this.apply(load());
			});
		}
	}

	private apply(pref: { on: boolean; volume: number }) {
		this.on = pref.on;
		this.volume = pref.volume;
	}

	private save() {
		try {
			localStorage.setItem(STORE_KEY, JSON.stringify({ on: this.on, volume: this.volume }));
		} catch {
			/* private window, blocked storage: the choice just does not outlive the tab */
		}
	}

	set_on(on: boolean) {
		this.on = on;
		this.save();
	}

	toggle() {
		this.set_on(!this.on);
	}

	set_volume(volume: number) {
		this.volume = volume;
		this.save();
	}
}

export const music = new MusicPref();
