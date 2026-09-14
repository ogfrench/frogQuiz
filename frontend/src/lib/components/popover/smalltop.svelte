<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { fly } from 'svelte/transition';
	import { getLocalization } from '$lib/i18n';
	import { PopoverTypes } from './smalltop';
	import { Button } from '$lib/components/ui/button';
	import X from '@lucide/svelte/icons/x';

	const { t } = getLocalization();

	interface Props {
		open?: boolean;
		type: PopoverTypes;
		data?: undefined | { game_pin: number | string; game_id: string } | string;
	}

	let { open = $bindable(false), type, data = undefined }: Props = $props();
</script>

{#if open}
	<!-- Was entirely un-migrated: hardcoded gray-500 on bg-white, which measured 2.60:1
	     for the close button against AA's 4.5, a 32px target, w-screen (100vw, so it
	     overflowed by the scrollbar width), and a missing space in
	     "shadow-smdark:text-gray-400" that silently broke both the shadow and the
	     dark-mode colour it was meant to set. -->
	<div
		class="fixed inset-x-0 top-10 z-[60] flex justify-center px-4"
		transition:fly|global={{ y: -100 }}
	>
		<div
			class="border-border bg-card text-card-foreground flex w-full max-w-sm items-center gap-3 rounded-lg border p-4 shadow-lg"
			role="alert"
		>
			<div class="min-w-0 flex-1 text-sm font-normal">
				{#if type === PopoverTypes.Copy}
					{$t('components.popover.copied_to_clipboard')}
				{:else if type === PopoverTypes.GameInLobby}A game is currently in the lobby. Click <a
						class="underline"
						href="/remote?game_pin={data.game_pin}&game_id={data.game_id}">here</a
					> to join as a remote.
				{:else if type === PopoverTypes.Generic}
					{@html data}
				{:else}
					<p>Error!!!</p>
				{/if}
			</div>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				class="shrink-0"
				aria-label={$t('words.close')}
				onclick={() => {
					open = false;
				}}
			>
				<X />
			</Button>
		</div>
	</div>
{/if}
