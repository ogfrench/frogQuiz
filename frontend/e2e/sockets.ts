// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// Raw socket.io clients for tests that need more players than browsers are worth, or
// need to send what the UI never would. They talk to the API directly (no Vite proxy):
// Node sends no Origin header, so the same-origin check does not apply.

import { expect, type APIRequestContext } from '@playwright/test';
import { io, type Socket } from 'socket.io-client';
import { saveQuiz, type QuizInput } from './helpers';

export const API_URL = process.env.E2E_API_URL ?? 'http://127.0.0.1:8010';

const opened: Socket[] = [];

export async function connect(): Promise<Socket> {
	const s = io(API_URL, { transports: ['websocket'], forceNew: true, reconnection: false });
	opened.push(s);
	// The real client answers every time_sync; without it the server has no latency for
	// the session and submit_answer raises KeyError('ping').
	s.on('time_sync', (d: string) => s.emit('echo_time_sync', d));
	await new Promise<void>((resolve, reject) => {
		s.once('connect', resolve);
		s.once('connect_error', reject);
	});
	return s;
}

export function closeAll() {
	for (const s of opened.splice(0)) s.close();
}

/** Resolves with the event's payload, or null if it does not arrive within `ms`. */
export function next<T = unknown>(s: Socket, event: string, ms = 3000): Promise<T | null> {
	return new Promise((resolve) => {
		const t = setTimeout(() => {
			s.off(event, on);
			resolve(null);
		}, ms);
		const on = (d: T) => {
			clearTimeout(t);
			resolve(d ?? ({} as T));
		};
		s.once(event, on);
	});
}

/** Collects every occurrence of an event from now on. */
export function record(s: Socket, event: string) {
	const seen: unknown[] = [];
	s.on(event, (d: unknown) => seen.push(d));
	return seen;
}

/**
 * Saves a quiz, starts a game on it, registers a host socket. Anonymous with the plain
 * `request` fixture; signed in when given a context's request that carries a session.
 */
export async function hostGame(request: APIRequestContext, quiz: QuizInput) {
	const saved = await saveQuiz(request, quiz);
	expect(saved.status).toBe(200);
	const res = await request.post(
		`/api/v1/quiz/start/${saved.body.id}?game_mode=kahoot&captcha_enabled=False`,
		{ headers: saved.secret ? { 'X-Anon-Secret': saved.secret } : {} }
	);
	expect(res.status()).toBe(200);
	const { game_pin, game_id } = await res.json();
	const host = await connect();
	const registered = next(host, 'registered_as_admin');
	host.emit('register_as_admin', { game_pin, game_id });
	expect(await registered, 'host registered').not.toBeNull();
	return {
		host,
		pin: String(game_pin),
		gameId: String(game_id),
		quizId: saved.body.id as string
	};
}

export async function join(pin: string, username: string) {
	const s = await connect();
	const joined = next(s, 'joined_game');
	const refused = Promise.race([
		next(s, 'username_already_exists').then((d) => d && 'username_already_exists'),
		next(s, 'game_already_started').then((d) => d && 'game_already_started'),
		next(s, 'game_not_found').then((d) => d && 'game_not_found'),
		next(s, 'error').then((d) => d && 'error')
	]);
	s.emit('join_game', { username, game_pin: pin });
	const outcome = await Promise.race([joined.then((d) => (d ? 'joined' : null)), refused]);
	// Give echo_time_sync a moment to land, or the first answer races it.
	await new Promise((r) => setTimeout(r, 100));
	return { socket: s, outcome: outcome ?? 'timeout' };
}

export async function joinAll(pin: string, names: string[]) {
	const players = await Promise.all(names.map((n) => join(pin, n)));
	for (const p of players) expect(p.outcome).toBe('joined');
	return players.map((p) => p.socket);
}

type AnswerRow = { username: string; answer: string; right: boolean; score: number };

export async function finalResults(host: Socket): Promise<Record<string, AnswerRow[]>> {
	const got = next<Record<string, AnswerRow[]>>(host, 'final_results');
	host.emit('get_final_results', {});
	const r = await got;
	expect(r, 'final_results').not.toBeNull();
	return r!;
}

export async function showQuestion(host: Socket, index: number) {
	const shown = next(host, 'set_question_number');
	host.emit('set_question_number', String(index));
	expect(await shown, `question ${index} shown`).not.toBeNull();
}
