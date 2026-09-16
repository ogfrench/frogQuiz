<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import DownloadQuiz from '$lib/components/DownloadQuiz.svelte';
	import type { QuizData } from '$lib/quiz_types';
	import { getLocalization } from '$lib/i18n';
	import Footer from '$lib/footer.svelte';
	import { signedIn } from '$lib/stores';
	import { navbarVisible } from '$lib/stores.svelte';
	import CommandpaletteNotice from '$lib/components/popover/commandpalettenotice.svelte';
	import Fuse from 'fuse.js';
	import type { PageData } from './$types';
	import StartGamePopup from '$lib/dashboard/start_game.svelte';
	import Analytics from './Analytics.svelte';
	import MediaComponent from '$lib/editor/MediaComponent.svelte';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import ChartColumn from '@lucide/svelte/icons/chart-column';
	import Download from '@lucide/svelte/icons/download';
	import Eye from '@lucide/svelte/icons/eye';
	import FolderOpen from '@lucide/svelte/icons/folder-open';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Play from '@lucide/svelte/icons/play';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import Settings from '@lucide/svelte/icons/settings';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Upload from '@lucide/svelte/icons/upload';
	import X from '@lucide/svelte/icons/x';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
	let search_term = $state('');
	let start_game = $state(null);
	let download_id: string | null = $state(null);
	signedIn.set(true);
	navbarVisible.visible = true;
	const { t } = getLocalization();

	let items_to_show = $state([]);
	let all_items: Array<any> = $state();
	let fuse;

	const getData = async (): Promise<{ items: Array<QuizData>; fuse: Fuse<any> }> => {
		const items: any[] = [];

		for (const q of data.quizzes) items.push({ ...q, type: 'quiz' });
		for (const q of data.quiztivities) items.push({ ...q, type: 'quiztivity' });

		const f = new Fuse(items, {
			keys: ['title', 'description', 'questions.title'],
			findAllMatches: true
		});

		return { items, fuse: f };
	};

	const search = () => {
		if (search_term === '') {
			items_to_show = all_items;
			return;
		}

		const res = fuse.search(search_term);
		items_to_show = res.map((r) => r.item);
	};

	onMount(async () => {
		const { items, fuse: f } = await getData();
		all_items = items;
		items_to_show = items;
		fuse = f;
		search();
	});

	const deleteQuiz = async (to_delete: string, type: 'quiz' | 'quiztivity') => {
		if (!confirm('Do you really want to delete this quiz?')) {
			return;
		}
		if (type === 'quiz') {
			await fetch(`/api/v1/quiz/delete/${to_delete}`, {
				method: 'DELETE'
			});
		} else {
			await fetch(`/api/v1/quiztivity/${to_delete}`, {
				method: 'DELETE'
			});
		}
		window.location.reload();
	};

	// The search box only earns its space once the list is long enough to scan badly.
	const SEARCH_THRESHOLD = 6;

	const question_count = (quiz): number =>
		Array.isArray(quiz.questions) ? quiz.questions.length : 0;

	let analytics_quiz_selected: undefined | QuizData = $state(undefined);
</script>

<svelte:head>
	<title>frogQuiz - Dashboard</title>
</svelte:head>
<Analytics bind:quiz={analytics_quiz_selected} />
<CommandpaletteNotice />

<div class="flex min-h-screen flex-col">
	<div class="mx-auto w-full max-w-5xl grow px-5 pt-8 pb-20">
		<header class="flex flex-wrap items-end justify-between gap-4">
			<div>
				<h1 class="text-3xl font-semibold tracking-tight">{$t('words.overview')}</h1>
				<p class="text-muted-foreground mt-1 text-sm">{$t('index_page.see_all_quizzes')}</p>
			</div>
			<Button href="/create" size="lg">
				<Plus />
				{$t('dashboard.create_quiz')}
			</Button>
		</header>

		<div class="mt-6 flex flex-wrap items-center gap-2">
			<Button href="/import" variant="outline" size="sm">
				<Upload />
				{$t('words.import')}
			</Button>
			<Button href="/results" variant="outline" size="sm">
				<ChartColumn />
				{$t('words.results')}
			</Button>
			<Button href="/edit/files" variant="outline" size="sm">
				<FolderOpen />
				{$t('words.files_library')}
			</Button>
			<Button href="/account/settings" variant="outline" size="sm">
				<Settings />
				{$t('words.settings')}
			</Button>
		</div>

		{#if !all_items}
			<div class="text-muted-foreground mt-16 flex justify-center">
				<LoaderCircle class="size-8 animate-spin" aria-label="Loading" />
			</div>
		{:else if all_items.length === 0}
			<div
				class="border-border mt-10 flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-16 text-center"
			>
				<p class="text-muted-foreground max-w-sm text-balance">
					{$t('overview_page.no_quizzes')}
				</p>
				<div class="flex flex-wrap justify-center gap-2">
					<Button href="/create">
						<Plus />
						{$t('dashboard.create_quiz')}
					</Button>
					<Button href="/import" variant="outline">
						<Upload />
						{$t('words.import')}
					</Button>
				</div>
			</div>
		{:else}
			{#if all_items.length > SEARCH_THRESHOLD}
				<div class="relative mt-8 max-w-sm">
					<Search
						class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
					/>
					<Input
						bind:value={search_term}
						oninput={search}
						class="pr-9 pl-9"
						placeholder={$t('dashboard.search_for_own_quizzes')}
					/>
					{#if search_term !== ''}
						<button
							type="button"
							aria-label={$t('words.search')}
							class="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1 focus-visible:ring-2 focus-visible:outline-none"
							onclick={() => {
								search_term = '';
								items_to_show = all_items;
							}}
						>
							<X class="size-4" />
						</button>
					{/if}
				</div>
			{/if}

			<ul class="mt-8 flex flex-col gap-3">
				{#each items_to_show as quiz (quiz.id)}
					<li
						class="border-border bg-card flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center"
					>
						{#if quiz.cover_image}
							<div
								class="bg-muted relative hidden h-16 w-24 shrink-0 overflow-hidden rounded-md sm:block"
							>
								<MediaComponent
									src={quiz.cover_image}
									css_classes="absolute inset-0 h-full w-full object-cover"
								/>
							</div>
						{/if}

						<div class="min-w-0 flex-1">
							<p class="truncate font-medium">{quiz.title}</p>
							{#if quiz.description}
								<p class="text-muted-foreground line-clamp-2 text-sm">
									{quiz.description}
								</p>
							{/if}
							<div class="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
								<Badge variant="secondary">
									{quiz.public ? $t('words.public') : $t('words.private')}
								</Badge>
								<span>
									{question_count(quiz)}
									{question_count(quiz) === 1
										? $t('words.question')
										: $t('words.question_plural')}
								</span>
							</div>
						</div>

						<div class="flex shrink-0 flex-wrap items-center gap-1.5">
							{#if quiz.type === 'quiz'}
								<Button
									onclick={() => {
										start_game = quiz.id;
									}}
								>
									<Play />
									{$t('words.play')}
								</Button>
							{:else}
								<Button href="/quiztivity/play?id={quiz.id}">
									<Play />
									{$t('words.play')}
								</Button>
							{/if}
							<Button
								href={quiz.type === 'quiz'
									? `/edit?quiz_id=${quiz.id}`
									: `/quiztivity/edit?id=${quiz.id}`}
								variant="ghost"
								size="icon"
								title={$t('words.edit')}
								aria-label={$t('words.edit')}
							>
								<Pencil />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								title={$t('words.analytics')}
								aria-label={$t('words.analytics')}
								onclick={() => (analytics_quiz_selected = quiz)}
							>
								<ChartColumn />
							</Button>
							<Button
								href="/view/{quiz.id}"
								variant="ghost"
								size="icon"
								disabled={!quiz.public}
								title={$t('words.view')}
								aria-label={$t('words.view')}
							>
								<Eye />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								disabled={quiz.type !== 'quiz'}
								title={$t('words.download')}
								aria-label={$t('words.download')}
								onclick={() => (download_id = quiz.id)}
							>
								<Download />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								title={$t('words.delete')}
								aria-label={$t('words.delete')}
								class="text-muted-foreground hover:text-destructive"
								onclick={() => {
									deleteQuiz(quiz.id, quiz.type);
								}}
							>
								<Trash2 />
							</Button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
	<Footer />
</div>

{#if start_game !== null}
	<StartGamePopup bind:quiz_id={start_game} />
{/if}
<DownloadQuiz bind:quiz_id={download_id} />
