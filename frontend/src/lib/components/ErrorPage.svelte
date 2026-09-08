<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { getLocalization } from '$lib/i18n';

	interface Props {
		status: number;
		description: string;
	}

	let { status, description }: Props = $props();

	const { t } = getLocalization();
</script>

<div class="flex min-h-[70vh] items-center justify-center px-4">
	<Card.Root class="w-full max-w-md">
		<Card.Header class="gap-2 text-center">
			<Card.Title class="text-muted-foreground font-mono text-6xl tabular-nums">
				{status}
			</Card.Title>
			<Card.Description class="text-foreground text-base">
				{description}
			</Card.Description>
		</Card.Header>
		<Card.Footer class="justify-center gap-2">
			<Button href="/" variant="default">{$t('words.home')}</Button>
			<Button variant="outline" onclick={() => location.reload()}>
				{$t('words.try_again')}
			</Button>
		</Card.Footer>
	</Card.Root>
</div>
