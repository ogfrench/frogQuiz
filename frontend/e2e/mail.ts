// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// What e2e/mailsink.py caught. Sign-in is by emailed link or code since 5 Oct, so every
// account in the suite is made and signed in through a real message, read back here.

import fs from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';

const MAIL_DIR = path.resolve(process.cwd(), '../e2e/.data/mail');

/**
 * A captured message, with its MIME parts decoded.
 *
 * `MIMEText(..., 'utf-8')` encodes base64, so the raw .eml carries no readable URL at
 * all: searching the encoded text reports "no link in the message" against a message
 * that has one. Decoding here also means a test notices if the parts stop being
 * well-formed MIME.
 */
export function decodeParts(raw: string): { headers: string; text: string; html: string } {
	const headerEnd = raw.indexOf('\n\n');
	const headers = raw.slice(0, headerEnd);
	const boundary = headers.match(/boundary="?([^"\s;]+)"?/)?.[1];
	const out = { headers, text: '', html: '' };
	if (!boundary) return out;

	for (const part of raw.split(`--${boundary}`)) {
		const split = part.indexOf('\n\n');
		if (split === -1) continue;
		const partHeaders = part.slice(0, split);
		let body = part.slice(split + 2);
		if (/content-transfer-encoding:\s*base64/i.test(partHeaders)) {
			body = Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8');
		}
		if (/content-type:\s*text\/plain/i.test(partHeaders)) out.text = body;
		if (/content-type:\s*text\/html/i.test(partHeaders)) out.html = body;
	}
	return out;
}

/** Messages the sink has written since `since` (epoch ms), newest first. */
function mailbox(since: number): string[] {
	if (!fs.existsSync(MAIL_DIR)) return [];
	return (
		fs
			.readdirSync(MAIL_DIR)
			.filter((f) => f.endsWith('.eml'))
			// The sink names each message after time.time(), "1791157126_025123.eml".
			.filter((f) => Number(f.replace('_', '.').replace('.eml', '')) * 1000 >= since - 1000)
			.sort()
			.reverse()
			// SMTP is CRLF on the wire and the sink writes what it is handed, so every blank
			// line is \r\n\r\n. Normalized here, or the part split never matches.
			.map((f) => fs.readFileSync(path.join(MAIL_DIR, f), 'utf8').replace(/\r\n/g, '\n'))
	);
}

/** Waits for a message to `to` written since `since`, and returns it decoded. */
export async function waitForMail(to: string, since = 0) {
	let found: string | undefined;
	await expect
		.poll(
			() => {
				const header = `to: ${to.toLowerCase()}`;
				found = mailbox(since).find((m) =>
					m.split('\n').some((line) => line.toLowerCase() === header)
				);
				return found !== undefined;
			},
			{ timeout: 20_000, message: `no message to ${to} in ${MAIL_DIR}` }
		)
		.toBe(true);
	return decodeParts(found!);
}

/** The link, its token and the code in the newest sign-in email to `to` since `since`. */
export async function signInMail(to: string, since: number) {
	const mail = await waitForMail(to, since);
	const link = mail.text.match(/https?:\/\/\S+[?&]token=[\w-]+/)?.[0];
	const code = mail.text.match(/code (\d{6})/)?.[1];
	expect(link, 'a sign-in link in the plain-text part').toBeTruthy();
	expect(code, 'a six-digit code in the plain-text part').toBeTruthy();
	return { link: link!, token: new URL(link!).searchParams.get('token')!, code: code!, mail };
}
