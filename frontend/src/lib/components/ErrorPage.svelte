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
		/** Defaults to "Page not found" or "Something went wrong" by status. */
		title?: string;
	}

	let { status, description, title }: Props = $props();

	const { t } = getLocalization();
</script>

<div class="flex min-h-[70vh] items-center justify-center px-4">
	<Card.Root class="w-full max-w-md">
		<!-- The status was the heading, in a monospace face nothing else in the app uses,
		     and not an h1. It is the eyebrow now; the heading says what happened. -->
		<Card.Header class="gap-2 text-center">
			<p class="text-muted-foreground text-sm font-medium tabular-nums">{status}</p>
			<h1 data-slot="card-title" class="text-2xl font-semibold tracking-tight">
				{title ??
					(status === 404
						? $t('error_page.404_title')
						: $t('error_page.unknown_error_title'))}
			</h1>
			<Card.Description class="text-base">
				{description}
			</Card.Description>
		</Card.Header>
		<Card.Footer class="justify-center gap-2">
			<Button href="/" variant="default">{$t('words.home')}</Button>
			<!-- Reloading cannot make a missing page appear; it only helps when the
			     server failed. -->
			{#if status >= 500}
				<Button variant="outline" onclick={() => location.reload()}>
					{$t('words.try_again')}
				</Button>
			{/if}
		</Card.Footer>
	</Card.Root>
</div>
