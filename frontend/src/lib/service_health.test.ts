// SPDX-FileCopyrightText: 2026 frogQuiz contributors
// SPDX-License-Identifier: MPL-2.0
import { expect, it } from 'vitest';
import { healthMessage } from './service_health';
it('only clears valid healthy responses and distinguishes degradation', () => {
	expect(healthMessage({ status: 'ok' }, true)).toBeNull();
	for (const payload of [null, {}, 'proxy error', { status: 'down' }])
		expect(healthMessage(payload, true)).toContain('Keep this tab open');
	expect(healthMessage({ status: 'ok' }, false)).toContain('Keep this tab open');
	expect(healthMessage({ status: 'degraded', search: 'down' }, true)).toContain('Quiz search');
	expect(healthMessage({ status: 'degraded', search: 'ok' }, true)).toContain('Some services');
});
