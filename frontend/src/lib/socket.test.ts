// SPDX-FileCopyrightText: 2026 frogQuiz contributors
// SPDX-License-Identifier: MPL-2.0

import { afterEach, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: false }));

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
});

it.each(['', 'http://127.0.0.1:1'])(
	'SSR does not open a game connection (origin: %s)',
	async (origin) => {
		vi.stubEnv('VITE_API_ORIGIN', origin);
		const { socket } = await import('./socket');
		try {
			// Active means it connects/reconnects even before a successful handshake.
			expect(socket.active).toBe(false);
			expect(socket.connected).toBe(false);
		} finally {
			socket.disconnect();
		}
	}
);
