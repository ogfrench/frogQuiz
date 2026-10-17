<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	// What a phone shows while the projector shows an Info slide (#93): there is nothing to
	// answer, and the last result card used to stay up asking to be read instead.
	import FrogAvatar from '$lib/components/FrogAvatar.svelte';
	import { getLocalization } from '$lib/i18n';

	const { t } = getLocalization();

	let { username }: { username: string } = $props();
</script>

<div class="fq-stage [--fq-stage-top:4rem]">
	<div role="status" class="flex max-w-xs flex-col items-center gap-5 text-center">
		<FrogAvatar name={username} class="size-28" />
		<p class="text-3xl font-bold tracking-tight text-balance">
			{$t('play_page.look_at_screen')}
		</p>
		<p class="text-muted-foreground text-base">{$t('play_page.look_at_screen_hint')}</p>
	</div>
</div>
