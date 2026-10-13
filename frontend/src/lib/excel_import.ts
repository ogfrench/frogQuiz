// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// Import from Excel: the browser keeps the file, asks the API to check it (`dry_run`), and
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

const upload = (file: File, doFetch: typeof fetch, dryRun: boolean) => {
	const body = new FormData();
	body.append('file', file);
	return doFetch(`/api/v1/quiz/excel-import${dryRun ? '?dry_run=true' : ''}`, {
		method: 'POST',
		body
	});
};

/** Checks a file without saving anything. Never throws: a dead server is a failure too. */
export async function previewExcel(
	file: File,
	doFetch: typeof fetch = fetch
): Promise<PreviewResult> {
	const local = checkFile(file);
	if (local) return { ok: false, reason: local };
	try {
		const res = await upload(file, doFetch, true);
		if (res.ok) return { ok: true, preview: (await res.json()) as Preview };
		if (res.status === 401) return { ok: false, reason: 'signed_out' };
		if (res.status === 413) return { ok: false, reason: 'too_big' };
		if (res.status === 429) return { ok: false, reason: 'rate_limited' };
	} catch {
		/* no answer, or a body that was not JSON */
	}
	return { ok: false, reason: 'failed' };
}

/** Creates the quiz from a file that previewed clean; the id of the new draft, or null. */
export async function confirmExcel(
	file: File,
	doFetch: typeof fetch = fetch
): Promise<string | null> {
	try {
		const res = await upload(file, doFetch, false);
		if (res.ok) {
			const { id } = await res.json();
			if (typeof id === 'string' && id !== '') return id;
		}
	} catch {
		/* falls through */
	}
	return null;
}
