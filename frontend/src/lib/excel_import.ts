// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// Import from Excel: the browser keeps the file, asks the preview endpoint to check it, and
// sends the same file again to create the quiz. The server holds nothing between the two.

export const MAX_FILE_BYTES = 2 * 1024 * 1024;

export interface PreviewQuestion {
	row: number;
	question: string;
	type: 'single' | 'multiple';
	time: number;
	answers: { text: string; right: boolean }[];
}

export interface RowError {
	/** Spreadsheet row, or null for a problem with the file as a whole. */
	row: number | null;
	column: string | null;
	message: string;
}

export interface Preview {
	title: string;
	description: string;
	questions: PreviewQuestion[];
	errors: RowError[];
}

export type PreviewResult =
	| { ok: true; preview: Preview }
	| { ok: false; reason: 'not_xlsx' | 'too_big' | 'signed_out' | 'rate_limited' | 'failed' };

export type ImportResult =
	| { ok: true; id: string; anonSecret: string | null }
	| { ok: false; reason: 'too_big' | 'signed_out' | 'rate_limited' | 'failed' };

/** "Row 4, Time: must be a whole number from 1 to 120". */
export const describeError = (e: RowError): string => {
	const where = [e.row !== null ? `Row ${e.row}` : null, e.column].filter(Boolean).join(', ');
	return where ? `${where}: ${e.message}` : e.message;
};

/** The file problems the browser can name before the server is asked. */
export const checkFile = (file: { name: string; size: number }): 'not_xlsx' | 'too_big' | null => {
	if (!file.name.toLowerCase().endsWith('.xlsx')) return 'not_xlsx';
	if (file.size > MAX_FILE_BYTES) return 'too_big';
	return null;
};

const upload = (file: File, doFetch: typeof fetch, dryRun: boolean, requireAccount: boolean) => {
	const body = new FormData();
	body.append('file', file);
	const query = new URLSearchParams();
	if (requireAccount) query.set('require_account', 'true');
	const endpoint = dryRun ? 'excel-preview' : 'excel-import';
	return doFetch(`/api/v1/quiz/${endpoint}${query.size ? `?${query}` : ''}`, {
		method: 'POST',
		body
	});
};

/** Checks a file without saving anything. Never throws: a dead server is a failure too. */
export async function previewExcel(
	file: File,
	doFetch: typeof fetch = fetch,
	requireAccount = false
): Promise<PreviewResult> {
	const local = checkFile(file);
	if (local) return { ok: false, reason: local };
	try {
		const res = await upload(file, doFetch, true, requireAccount);
		if (res.ok) {
			const preview = await res.json();
			if (
				typeof preview.title === 'string' &&
				typeof preview.description === 'string' &&
				Array.isArray(preview.questions) &&
				Array.isArray(preview.errors)
			) {
				return { ok: true, preview };
			}
		}
		if (res.status === 401) return { ok: false, reason: 'signed_out' };
		if (res.status === 413) return { ok: false, reason: 'too_big' };
		if (res.status === 429) return { ok: false, reason: 'rate_limited' };
	} catch {
		/* no answer, or a body that was not JSON */
	}
	return { ok: false, reason: 'failed' };
}

/** Explicit confirmation; guest ownership is returned separately from the quiz id. */
export async function confirmExcel(
	file: File,
	doFetch: typeof fetch = fetch,
	requireAccount = false
): Promise<ImportResult> {
	try {
		const res = await upload(file, doFetch, false, requireAccount);
		if (res.ok) {
			const { id, anonymous } = await res.json();
			const anonSecret = res.headers.get('X-Anon-Secret');
			if (typeof id === 'string' && id !== '' && (anonymous !== true || anonSecret)) {
				return { ok: true, id, anonSecret };
			}
		}
		if (res.status === 401) return { ok: false, reason: 'signed_out' };
		if (res.status === 413) return { ok: false, reason: 'too_big' };
		if (res.status === 429) return { ok: false, reason: 'rate_limited' };
	} catch {
		/* falls through */
	}
	return { ok: false, reason: 'failed' };
}
