<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	// Locked, nobody new can join; unlocked, anyone with the PIN can, mid-game included, as
	// in Kahoot. Shows what the server last said, so a lock that never arrived does not
	// read as locked.
	import { getLocalization } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button/index.js';
	import Lock from '@lucide/svelte/icons/lock';
	import LockOpen from '@lucide/svelte/icons/lock-open';
	import type { SocketGameControls } from '$lib/play/admin/socket_game_controls.ts';

	interface Props {
		locked?: boolean;
		socket_game_controls: SocketGameControls;
		/** Hide the words below `sm`, for the in-game bar on a narrow screen. */
		compact?: boolean;
		class?: string;
	}

	let {
		locked = false,
		socket_game_controls,
		compact = false,
		class: className = ''
	}: Props = $props();

	const { t } = getLocalization();
</script>

<Button variant="ghost" class={className} onclick={() => socket_game_controls.set_locked(!locked)}>
	{#if locked}<Lock />{:else}<LockOpen />{/if}
	<span class={compact ? 'max-sm:sr-only' : ''}
		>{locked ? $t('admin_page.unlock_game') : $t('admin_page.lock_game')}</span
	>
</Button>
