// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// The live game at the protocol level: crowds, rule enforcement, and things only a
// crafted client would send. The browser specs cover how it looks; this covers what the
// server allows.

import { expect, test } from '@playwright/test';
import { mc } from './helpers';
import {
	closeAll,
	connect,
	finalResults,
	hostGame,
	join,
	joinAll,
	next,
	record,
	showQuestion
} from './sockets';

const QUIZ = {
	title: 'Socket game',
	description: 'e2e',
	questions: [
		mc('Capital of Portugal?', [
			['Lisbon', true],
			['Porto', false]
		]),
		mc(
			'Short timer',
			[
				['yes', true],
				['no', false]
			],
			'2'
		)
	]
};

test.afterEach(closeAll);

test.describe('crowd', () => {
	for (const [label, spreadMs] of [
		['at once', 0],
		['spread over 2 s', 2000]
	] as const)
		test(`fifty players join, answer ${label}, and all land in the results`, async ({
			request
		}) => {
			const { host, pin } = await hostGame(request, QUIZ);
			const joinedOnHost = record(host, 'player_joined');
			const names = Array.from(
				{ length: 50 },
				(_, i) => `player${String(i).padStart(2, '0')}`
			);
			const players = await joinAll(pin, names);
			await expect.poll(() => joinedOnHost.length).toBe(50);

			const started = players.map((p) => next(p, 'start_game'));
			host.emit('start_game', {});
			expect((await Promise.all(started)).every(Boolean)).toBe(true);

			await showQuestion(host, 0);
			const everyone = next(host, 'everyone_answered', 10_000);
			players.forEach((p, i) =>
				setTimeout(
					() =>
						p.emit('submit_answer', {
							question_index: 0,
							answer: i % 2 ? 'Porto' : 'Lisbon'
						}),
					Math.random() * spreadMs
				)
			);
			await new Promise((r) => setTimeout(r, spreadMs + 500));
			const everyoneArrived = await everyone;
			const results = await finalResults(host);
			test.info().annotations.push({
				type: 'answers stored',
				description: String(results['0'].length)
			});
			console.log(`[crowd ${label}] ${results['0'].length}/50 answers stored`);
			expect(results['0'], 'answers stored out of 50 submitted').toHaveLength(50);
			expect(everyoneArrived, 'everyone_answered after the 50th answer').not.toBeNull();
			expect(new Set(results['0'].map((r) => r.username)).size).toBe(50);
			for (const r of results['0']) {
				expect(r.right).toBe(r.answer === 'Lisbon');
				if (r.right) expect(r.score).toBeGreaterThan(0);
				else expect(r.score).toBe(0);
			}
		});

	test('two players racing for the same nickname: exactly one gets it', async ({ request }) => {
		const { pin } = await hostGame(request, QUIZ);
		const outcomes = (
			await Promise.all(Array.from({ length: 5 }, () => join(pin, 'samename')))
		).map((p) => p.outcome);
		test.info().annotations.push({ type: 'outcomes', description: outcomes.join(', ') });
		expect(outcomes.filter((o) => o === 'joined')).toHaveLength(1);
	});
});

test.describe('joining', () => {
	test('a wrong PIN is "game not found"', async () => {
		expect((await join('000000', 'someone')).outcome).toBe('game_not_found');
	});

	test('a taken nickname is refused, including with extra whitespace', async ({ request }) => {
		const { pin } = await hostGame(request, QUIZ);
		expect((await join(pin, 'anabela')).outcome).toBe('joined');
		expect((await join(pin, 'anabela')).outcome).toBe('username_already_exists');
		expect((await join(pin, '  anabela ')).outcome).toBe('username_already_exists');
	});

	test('nickname bounds: over 50 characters and blank are refused', async ({ request }) => {
		const { pin } = await hostGame(request, QUIZ);
		expect((await join(pin, 'x'.repeat(51))).outcome).toBe('error');
		expect((await join(pin, '   ')).outcome).toBe('error');
		expect((await join(pin, '🐸 Zoë ناصر')).outcome).toBe('joined');
	});

	test('nobody can join once the game has started', async ({ request }) => {
		const { host, pin } = await hostGame(request, QUIZ);
		await joinAll(pin, ['early']);
		host.emit('start_game', {});
		await new Promise((r) => setTimeout(r, 300));
		expect((await join(pin, 'latecomer')).outcome).toBe('game_already_started');
	});
});

test.describe('answering', () => {
	test('a second answer to the same question is refused and not scored', async ({ request }) => {
		const { host, pin } = await hostGame(request, QUIZ);
		// A second player keeps the question open: with one, the first answer is
		// "everyone answered", and the retry is refused as question_not_active instead.
		const [p] = await joinAll(pin, ['twice', 'bystander']);
		host.emit('start_game', {});
		await showQuestion(host, 0);
		p.emit('submit_answer', { question_index: 0, answer: 'Porto' });
		const again = next(p, 'already_replied');
		await new Promise((r) => setTimeout(r, 200));
		p.emit('submit_answer', { question_index: 0, answer: 'Lisbon' });
		expect(await again).not.toBeNull();
		const rows = (await finalResults(host))['0'];
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ answer: 'Porto', right: false, score: 0 });
	});

	test('an answer to a question that is not showing is refused', async ({ request }) => {
		const { host, pin } = await hostGame(request, QUIZ);
		const [p] = await joinAll(pin, ['ahead']);
		host.emit('start_game', {});
		await showQuestion(host, 0);
		const refused = next(p, 'question_not_active');
		p.emit('submit_answer', { question_index: 1, answer: 'yes' });
		expect(await refused).not.toBeNull();
	});

	test.describe('after the question closes', () => {
		test('an answer after the timer ran out scores nothing, and never negative', async ({
			request
		}) => {
			const { host, pin } = await hostGame(request, QUIZ);
			const [p] = await joinAll(pin, ['slowpoke']);
			host.emit('start_game', {});
			await showQuestion(host, 1); // 2 s timer
			await new Promise((r) => setTimeout(r, 4000));
			p.emit('submit_answer', { question_index: 1, answer: 'yes' });
			await new Promise((r) => setTimeout(r, 300));
			const rows = (await finalResults(host))['1'] ?? [];
			test.info().annotations.push({ type: 'rows', description: JSON.stringify(rows) });
			console.log(`[late answer] ${JSON.stringify(rows)}`);
			expect(
				rows.every((r) => r.score >= 0),
				'negative score recorded'
			).toBe(true);
			expect(rows).toHaveLength(0);
		});

		test('an answer after the host showed the results is refused', async ({ request }) => {
			const { host, pin } = await hostGame(request, QUIZ);
			const [a, b] = await joinAll(pin, ['prompt', 'peeker']);
			host.emit('start_game', {});
			await showQuestion(host, 0);
			const recorded = next(host, 'player_answer');
			a.emit('submit_answer', { question_index: 0, answer: 'Lisbon' });
			expect(await recorded).not.toBeNull();
			const results = next(b, 'question_results');
			host.emit('get_question_results', { question_number: 0 });
			// The results broadcast reaches every player, answers included.
			expect(JSON.stringify(await results)).toContain('Lisbon');
			b.emit('submit_answer', { question_index: 0, answer: 'Lisbon' });
			await new Promise((r) => setTimeout(r, 300));
			const rows = (await finalResults(host))['0'];
			expect(rows.map((r) => r.username)).toEqual(['prompt']);
		});
	});
});

test.describe('host control', () => {
	test('a player cannot make themselves host with register_as_remote', async ({ request }) => {
		const { pin } = await hostGame(request, QUIZ);
		const [victim, attacker] = await joinAll(pin, ['victim', 'attacker']);
		const leaked = next(attacker, 'registered_as_admin');
		attacker.emit('register_as_remote', { game_pin: pin, game_id: 'anything' });
		const payload = JSON.stringify(await leaked);
		test.info().annotations.push({
			type: 'leaked "right":true',
			description: String(payload.includes('\\"right\\": true'))
		});
		expect(payload, 'quiz with solutions sent to a player').not.toContain('Lisbon');

		const started = next(victim, 'start_game', 1500);
		attacker.emit('start_game', {});
		expect(await started, 'a player started the game').toBeNull();
	});

	test('a kicked player cannot rejoin with their old session', async ({ request }) => {
		const { host, pin } = await hostGame(request, QUIZ);
		const [p] = await joinAll(pin, ['troll']);
		const oldSid = p.id!;
		const kicked = next(p, 'kick');
		host.emit('kick_player', { username: 'troll' });
		expect(await kicked).not.toBeNull();
		p.close();

		const back = await connect();
		const rejoined = next(back, 'rejoined_game', 1500);
		back.emit('rejoin_game', { old_sid: oldSid, game_pin: pin, username: 'troll' });
		expect(await rejoined, 'kicked player rejoined').toBeNull();
	});

	test('a player cannot get the host credential, nor take the seat without it', async ({
		request
	}) => {
		// GET /quiz/join/{pin} used to return the game_id to anyone with the PIN, and the
		// game_id is all register_as_admin asks for.
		const { pin } = await hostGame(request, QUIZ);
		const [attacker] = await joinAll(pin, ['attacker']);
		const joinRoute = await request.get(`/api/v1/quiz/join/${pin}`);
		expect(joinRoute.status()).toBe(410);

		const took = next(attacker, 'registered_as_admin', 1500);
		attacker.emit('register_as_admin', { game_pin: pin, game_id: crypto.randomUUID() });
		expect(await took, 'a player registered as the host').toBeNull();
	});

	test('the game sent to players does not carry the host credential', async ({ request }) => {
		const { pin } = await hostGame(request, QUIZ);
		const p = await connect();
		const joined = next(p, 'joined_game');
		p.emit('join_game', { username: 'reader', game_pin: pin });
		const game = await joined;
		expect(game).not.toBeNull();
		expect(game).not.toHaveProperty('game_id');
	});

	test("one game's events do not reach another game's host", async ({ request }) => {
		const a = await hostGame(request, QUIZ);
		const b = await hostGame(request, QUIZ);
		const [pa] = await joinAll(a.pin, ['in_a']);
		await joinAll(b.pin, ['in_b']);
		a.host.emit('start_game', {});
		await showQuestion(a.host, 0);
		const leak = next(b.host, 'everyone_answered', 1500);
		pa.emit('submit_answer', { question_index: 0, answer: 'Lisbon' });
		expect(await leak, "game B's host told everyone answered in game A").toBeNull();
	});
});
