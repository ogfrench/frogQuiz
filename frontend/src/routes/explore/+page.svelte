<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import RetryNotice from '$lib/components/RetryNotice.svelte';
	import { goto } from '$app/navigation';
	import { getLocalization } from '$lib/i18n';
	import SearchCard from '$lib/search-card.svelte';
	import { Button } from '$lib/components/ui/button';
	import { openCreateDialog } from '$lib/create_dialog.svelte';
	import { Input } from '$lib/components/ui/input';
	import Search from '@lucide/svelte/icons/search';
	import type { PageData } from './$types';

	const { t } = getLocalization();

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Seeded from the URL and re-seeded whenever the load reruns, so the box still
	// holds the term after a back/forward navigation. The old search page kept the
	// term in component state and pushed the URL by hand, which meant Back changed the
	// address bar and left the results and the box alone.
	// A writable $derived: typing reassigns it, and a navigation that changes `data.q`
	// resets it to whatever the URL says.
	let term = $derived(data.q);

	const query = $derived(data.q.trim());
	const has_examples = $derived(data.examples.quizzes.length > 0);
	const sign_in_href = $derived(
		`/account/login?returnTo=${encodeURIComponent(
			data.q ? `/explore?q=${encodeURIComponent(data.q)}` : '/explore'
		)}`
	);

	// Explicit submit rather than searching as you type: every keystroke would be a
	// Meilisearch request, and the URL is the state here.
	const submit = (event: Event) => {
		event.preventDefault();
		const q = term.trim();
		goto(q === '' ? '/explore' : `/explore?q=${encodeURIComponent(q)}`, {
			keepFocus: true,
			noScroll: true
		});
	};
</script>

{#snippet hitGrid(spacing: string)}
	<div class="{spacing} grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.hits as quiz (quiz.id)}
			<SearchCard {quiz} />
		{/each}
	</div>
{/snippet}

<svelte:head>
	<title>{$t('words.discover')} — frogQuiz</title>
</svelte:head>

<!-- fq-section, not fq-stage: fq-stage is min-height:100dvh plus justify-center, which
     is the projector composition. This is a list that can be any length. -->
<div class="fq-section fq-gutter py-10">
	<div class="w-full max-w-5xl">
		<!-- The navbar calls this Discover; the page called itself Explore. The URL stays
		     /explore (MVP.md section 2) -- it is the label that had drifted. -->
		<h1 class="text-2xl font-semibold tracking-tight">{$t('words.discover')}</h1>

		{#if data.logged_in}
			<form class="mt-4 flex gap-2" onsubmit={submit}>
				<Input
					type="search"
					class="min-w-0 flex-1"
					bind:value={term}
					placeholder={$t('explore_page.search_placeholder')}
					aria-label={$t('words.search')}
					aria-describedby="search-hint"
				/>
				<Button type="submit" class="shrink-0">
					<Search />
					<span class="sr-only sm:not-sr-only">{$t('words.search')}</span>
				</Button>
			</form>
			<p id="search-hint" class="text-muted-foreground mt-2 text-sm">
				{$t('search_page.at_least_3_characters')}
			</p>
		{:else}
			<div class="mt-4 flex flex-wrap items-center gap-3">
				<p class="text-muted-foreground text-sm">{$t('explore_page.sign_in_to_search')}</p>
				<Button href={sign_in_href} variant="outline">
					{$t('sign_in.sign_in')}
				</Button>
			</div>
		{/if}

		<!-- Browsing only; the load leaves it empty for a search. Shown whatever became of
		     the search itself: they are separate requests, and a failed Newest should not
		     take the ready-made quizzes down with it. -->
		{#if data.examplesFailed}
			<RetryNotice message="We couldn’t load example quizzes. Please try again." />
		{/if}
		{#if has_examples}
			<section class="mt-8" aria-labelledby="examples-heading">
				<h2 id="examples-heading" class="text-lg font-semibold tracking-tight">
					{$t('explore_page.examples')}
				</h2>
				<p class="text-muted-foreground mt-1 text-sm">
					{$t(
						data.logged_in
							? 'explore_page.examples_hint'
							: 'explore_page.examples_hint_signed_out'
					)}
				</p>
				<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each data.examples.quizzes as quiz (quiz.id)}
						<SearchCard {quiz} questions={quiz.questions} />
					{/each}
				</div>
			</section>
		{/if}

		{#if data.logged_in && data.failed}
			<RetryNotice message="We couldn’t load quizzes. Please try again." />
		{/if}

		<!-- Always in the DOM, so a submit that keeps focus in the field (keepFocus) still
		     announces what came back: a live region only speaks for changes made inside an
		     element that was already there. Browse says "Newest"; a search says what was asked
		     and how many, or that nothing matched. The too-short rule lives under the field. -->
		<div aria-live="polite">
			{#if data.logged_in && !data.failed && data.mode !== 'too_short'}
				{#if data.hits.length > 0}
					<h2 id="results-heading" class="mt-10 text-lg font-semibold tracking-tight">
						{#if data.mode === 'search'}
							{$t('explore_page.results_for', { q: query, count: data.hits.length })}
						{:else}
							{$t('explore_page.newest')}
						{/if}
					</h2>
				{:else if data.mode === 'search'}
					<p class="text-muted-foreground mt-10 text-center text-sm">
						{$t('explore_page.no_match', { q: query })}
					</p>
				{:else if !has_examples && !data.examplesFailed}
					<!-- With examples above, a list that is empty because they were taken out of
					     it is not an empty page. -->
					<div class="mt-10 text-center">
						<p class="text-lg font-medium">{$t('explore_page.nothing_yet')}</p>
						<Button href="/create" class="mt-4" onclick={openCreateDialog}
							>{$t('explore_page.create_one')}</Button
						>
					</div>
				{/if}
			{/if}
		</div>
		{#if data.logged_in && !data.failed && data.hits.length > 0 && data.mode !== 'too_short'}
			<section aria-labelledby="results-heading">
				{@render hitGrid('mt-4')}
			</section>
		{/if}
	</div>
</div>
