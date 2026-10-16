// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// Keys for AI agents, from My Account to an agent using one and back (docs/mcp.md). Needs
// AGENT_API_ENABLED, which e2e.env sets. The MCP half runs when run.sh started the MCP
// service, which it does when mcp-server/.venv exists, and is skipped otherwise.

import { expect, test, type APIRequestContext } from '@playwright/test';
import { signedInContext } from './accounts';
import { expectNoHorizontalOverflow, PHONE } from './helpers';
import { API_URL } from './sockets';

const MCP_URL = process.env.E2E_MCP_URL;

async function agentMe(request: APIRequestContext, key: string) {
	return request.get(`${API_URL}/api/v1/agent/me`, {
		headers: { Authorization: `Bearer ${key}` }
	});
}

async function mcpInitialize(request: APIRequestContext, key: string) {
	return request.post(MCP_URL!, {
		headers: {
			Authorization: `Bearer ${key}`,
			Accept: 'application/json, text/event-stream',
			'MCP-Protocol-Version': '2025-06-18'
		},
		data: {
			jsonrpc: '2.0',
			id: 1,
			method: 'initialize',
			params: {
				protocolVersion: '2025-06-18',
				capabilities: {},
				clientInfo: { name: 'e2e', version: '0' }
			}
		}
	});
}

test('a key made on My Account is shown once, works for an agent, and stops when revoked', async ({
	browser,
	request
}) => {
	const { context, page, user } = await signedInContext(browser, request);
	await page.goto('/account/settings');
	const card = page.getByTestId('agent-keys');
	await expect(card.getByText('AI agents')).toBeVisible();

	await card.getByLabel('Key name').fill('Claude on my laptop');
	await card.getByRole('button', { name: 'Create key' }).click();

	const key = await card.getByLabel('Key', { exact: true }).inputValue();
	expect(key).toMatch(/^fq_[A-Za-z0-9_-]{43}$/);
	if (MCP_URL) {
		await expect(card.getByLabel('Add it to Claude Code')).toHaveValue(
			`claude mcp add --scope user --transport http frogquiz ${MCP_URL} --header "Authorization: Bearer ${key}"`
		);
	}

	// Done, or a reload, and the key is gone for good: only its first characters remain.
	await card.getByRole('button', { name: 'Done' }).click();
	await expect(card.getByLabel('Key', { exact: true })).toHaveCount(0);
	await page.reload();
	await expect(card.getByText('Claude on my laptop')).toBeVisible();
	await expect(card.getByText(`${key.slice(0, 7)}…`)).toBeVisible();
	expect(await page.content()).not.toContain(key);

	const me = await agentMe(request, key);
	expect(me.status()).toBe(200);
	expect((await me.json()).username).toBe(user.username);
	if (MCP_URL) {
		const init = await mcpInitialize(request, key);
		expect(init.status(), await init.text()).toBe(200);
		expect((await init.json()).result.serverInfo.name).toBe('frogQuiz');
	}

	// Revoking asks first, and Cancel keeps the key.
	await card.getByRole('button', { name: 'Revoke Claude on my laptop' }).click();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
	expect((await agentMe(request, key)).status()).toBe(200);

	await card.getByRole('button', { name: 'Revoke Claude on my laptop' }).click();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Revoke' }).click();
	await expect(card.getByText('Claude on my laptop')).toHaveCount(0);
	// At once, not when a cache runs out.
	expect((await agentMe(request, key)).status()).toBe(401);
	if (MCP_URL) {
		expect((await mcpInitialize(request, key)).status()).toBe(401);
	}
	await context.close();
});

test('the AI agents section fits a phone with a key showing', async ({ browser, request }) => {
	const { context, page } = await signedInContext(browser, request);
	await page.setViewportSize(PHONE);
	await page.goto('/account/settings');
	const card = page.getByTestId('agent-keys');
	await card.getByLabel('Key name').fill('A key with a rather long name for a phone');
	await card.getByRole('button', { name: 'Create key' }).click();
	await expect(card.getByLabel('Key', { exact: true })).toBeVisible();
	await expectNoHorizontalOverflow(page);
	await card.getByRole('button', { name: 'Done' }).click();
	await expectNoHorizontalOverflow(page);
	await context.close();
});
