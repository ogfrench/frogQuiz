<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { getLocalization } from '$lib/i18n';
	import ImportedOrNot from '$lib/view_quiz/imported_or_not.svelte';
	import { highlightToHtml } from '$lib/search/highlight';
	import * as Card from '$lib/components/ui/card/index.js';

	const { t } = getLocalization();

	let { quiz } = $props();
</script>

<!--
	Was `bg-white … dark:bg-slate-800` with `text-gray-800`/`text-gray-600` and a
	`my-20` margin on every card, which is where the huge gaps between rows came from:
	the grid had no gap and each card paid for its own spacing. Tokens and a grid gap
	now, so it survives a theme change and lines up.

	`min-w-0` is on the link rather than only the text: a grid item defaults to
	`min-width: auto`, so a long unbroken title pushed the card out of its column.
-->
<a
	href="/view/{quiz.id}"
	class="focus-visible:ring-ring block min-w-0 rounded-xl focus-visible:ring-2 focus-visible:outline-none"
>
	<Card.Root class="hover:ring-primary/40 h-full transition">
		<Card.Header>
			<div class="flex min-w-0 items-start gap-2">
				<Card.Title class="min-w-0 flex-1 truncate text-xl">
					<!-- highlightToHtml escapes the author's text and restores only
					     Meilisearch's <em> pair as <mark>. See lib/search/highlight.ts. -->
					{@html highlightToHtml(quiz.title)}
				</Card.Title>
				<span class="shrink-0">
					<ImportedOrNot imported={quiz.imported_from_kahoot} />
				</span>
			</div>
			<Card.Description class="line-clamp-3 break-words">
				{@html highlightToHtml(quiz.description)}
			</Card.Description>
		</Card.Header>
		<Card.Footer class="text-muted-foreground text-sm">
			<span class="min-w-0 truncate">
				{#if quiz.imported_from_kahoot === true}
					{$t('explore_page.imported_by')}
				{:else}
					{$t('explore_page.made_by')}
				{/if}
				{quiz.user}
			</span>
		</Card.Footer>
	</Card.Root>
</a>
