// SPDX-FileCopyrightText: 2026 frogQuiz contributors
// SPDX-License-Identifier: MPL-2.0

import { describe, expect, it, vi } from 'vitest';
import {
	checkFile,
	confirmExcel,
	describeError,
	MAX_FILE_BYTES,
	previewExcel
} from './excel_import';

const file = () => new File(['workbook'], 'quiz.xlsx');
const preview = {
	title: 'A quiz',
	description: '',
	questions: [],
	errors: [{ row: 14, column: 'Time', message: 'Fix the timer' }]
};
const reply = (status: number, body: unknown = {}, headers: Record<string, string> = {}) =>
	vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status, headers }));

describe('Excel import requests', () => {
	it('rejects extension and file size before sending any request', async () => {
		const fetch = reply(200, preview);
		expect(await previewExcel(new File(['x'], 'quiz.csv'), fetch)).toEqual({
			ok: false,
			reason: 'not_xlsx'
		});
		expect(fetch).not.toHaveBeenCalled();
		expect(checkFile({ name: 'QUIZ.XLSX', size: MAX_FILE_BYTES })).toBeNull();
		expect(checkFile({ name: 'quiz.xlsx', size: MAX_FILE_BYTES + 1 })).toBe('too_big');
	});

	it('preview uses its own endpoint, returns row errors, and sends no ownership secret', async () => {
		const fetch = reply(200, preview);
		expect(await previewExcel(file(), fetch)).toEqual({ ok: true, preview });
		const [url, options] = fetch.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('/api/v1/quiz/excel-preview');
		expect(options.body).toBeInstanceOf(FormData);
		expect(options.headers).toBeUndefined();
		expect(describeError(preview.errors[0])).toBe('Row 14, Time: Fix the timer');
	});

	it('refuses a mismatched preview response rather than treating a saved quiz as a preview', async () => {
		expect(await previewExcel(file(), reply(200, { id: 'already-saved' }))).toEqual({
			ok: false,
			reason: 'failed'
		});
	});

	it('confirmation returns guest ownership from the response header', async () => {
		const fetch = reply(200, { id: 'draft', anonymous: true }, { 'X-Anon-Secret': 'secret' });
		expect(await confirmExcel(file(), fetch)).toEqual({
			ok: true,
			id: 'draft',
			anonSecret: 'secret'
		});
		expect(fetch.mock.calls[0][0]).toBe('/api/v1/quiz/excel-import');
	});

	it('refuses a guest success that is missing its ownership secret', async () => {
		expect(await confirmExcel(file(), reply(200, { id: 'draft', anonymous: true }))).toEqual({
			ok: false,
			reason: 'failed'
		});
	});

	it('an account import cannot silently become anonymous after a session expires', async () => {
		const fetch = reply(401);
		expect(await confirmExcel(file(), fetch, true)).toEqual({
			ok: false,
			reason: 'signed_out'
		});
		expect(fetch.mock.calls[0][0]).toBe('/api/v1/quiz/excel-import?require_account=true');
	});

	it.each([
		[413, 'too_big'],
		[429, 'rate_limited'],
		[500, 'failed']
	] as const)('reports %s for preview and confirmation', async (status, reason) => {
		expect(await previewExcel(file(), reply(status))).toEqual({ ok: false, reason });
		expect(await confirmExcel(file(), reply(status))).toEqual({ ok: false, reason });
	});

	it('handles a lost connection without promising that the server saved nothing', async () => {
		const fetch = vi.fn(async () => {
			throw new TypeError('offline');
		});
		expect(await confirmExcel(file(), fetch)).toEqual({ ok: false, reason: 'failed' });
	});
});
