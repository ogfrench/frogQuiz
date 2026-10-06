// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// A module, so this extends svelte/elements instead of replacing it.
import 'svelte/elements';

declare module 'svelte/elements' {
	// Safari's AirPlay switch on a <video>; lib/editor/MediaComponent.svelte turns it off.
	interface HTMLVideoAttributes {
		'x-webkit-airplay'?: 'allow' | 'deny';
	}
}
