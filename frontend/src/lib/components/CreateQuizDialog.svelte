<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import RetryNotice from '$lib/components/RetryNotice.svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getLocalization } from '$lib/i18n';
	import { signedIn } from '$lib/stores';
	import { createDialog } from '$lib/create_dialog.svelte';
	import { canRememberAnonQuiz, setAnonSecret } from '$lib/anon_quiz';
	import {
		checkFile,
		confirmExcel,
		describeError,
		previewExcel,
		type Preview
	} from '$lib/excel_import';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils';
	import PencilLine from '@lucide/svelte/icons/pencil-line';
	import FileSpreadsheet from '@lucide/svelte/icons/file-spreadsheet';
	import Upload from '@lucide/svelte/icons/upload';
	import Download from '@lucide/svelte/icons/download';
	import Check from '@lucide/svelte/icons/check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';

	const { t } = getLocalization();

	type Step = 'choose' | 'upload' | 'checking' | 'preview';
	let step = $state<Step>('choose');
	let file = $state<File | null>(null);
	let preview = $state<Preview | null>(null);
	let problem = $state<string | null>(null);
	let creating = $state(false);
	let dragging = $state(false);
	let previewRequest = 0;
	let questionList = $state<HTMLOListElement | null>(null);
	let atEnd = $state(false);
	function updateScroll() {
		if (questionList)
			atEnd =
				questionList.scrollTop + questionList.clientHeight >= questionList.scrollHeight - 4;
	}

	const clean = $derived(preview !== null && preview.errors.length === 0);
	// The shared layout also renders static docs, whose build has no query string.
	const login_href = $derived(
		`/account/login?returnTo=${encodeURIComponent(page.url.pathname + (browser ? page.url.search : ''))}`
	);

	// A closed dialog starts over, so the next one is not a stale preview.
	$effect(() => {
		if (!createDialog.open) {
			previewRequest++;
			step = 'choose';
			file = null;
			preview = null;
			problem = null;
			creating = false;
			dragging = false;
		}
	});

	const choose = async (picked: File | undefined) => {
		if (!picked) return;
		problem = null;
		const local = checkFile(picked);
		if (local) {
			problem = $t(`create_dialog.error_${local}`);
			return;
		}
		file = picked;
		step = 'checking';
		const request = ++previewRequest;
		const result = await previewExcel(picked, fetch, $signedIn);
		if (!createDialog.open || request !== previewRequest) return;
		if (result.ok === true) {
			preview = result.preview;
			atEnd = false;
			step = 'preview';
		} else {
			problem = $t(`create_dialog.error_${result.reason}`);
			file = null;
			step = 'upload';
		}
	};

	const create = async () => {
		if (!file || !clean || creating) return;
		if (!$signedIn && !canRememberAnonQuiz()) {
			problem = $t('create_dialog.error_browser_storage');
			return;
		}
		creating = true;
		const result = await confirmExcel(file, fetch, $signedIn);
		if (result.ok === false) {
			problem = $t(`create_dialog.error_${result.reason}`);
			creating = false;
			return;
		}
		if (result.anonSecret) setAnonSecret(result.id, result.anonSecret);
		createDialog.open = false;
		await goto(`/edit?quiz_id=${result.id}`);
	};

	const again = () => {
		file = null;
		preview = null;
		problem = null;
		step = 'upload';
	};

	// On a phone each choice is a row, icon then text; from sm the two sit side by side as
	// cards. The icon sits in one fixed box so the two glyphs read as the same size.
	const optionClass =
		'group border-border bg-card hover:border-foreground/30 hover:bg-muted/50 focus-visible:ring-ring grid flex-1 min-w-0 grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 rounded-xl border p-4 text-left transition-colors outline-none focus-visible:ring-2 sm:min-h-36 sm:grid-cols-1 sm:gap-y-2';
	const optionIcon =
		'bg-muted text-muted-foreground row-span-2 grid size-10 place-items-center rounded-lg sm:row-span-1';
</script>

<Dialog.Root
	bind:open={
		() => createDialog.open,
		(value) => {
			if (!creating) createDialog.open = value;
		}
	}
>
	<Dialog.Content
		class={cn(
			step === 'preview' && '!flex !flex-col !gap-4 !overflow-hidden sm:!max-w-2xl',
			'max-sm:left-0 max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:content-start max-sm:overflow-y-auto sm:max-h-[90dvh] sm:max-w-xl sm:overflow-y-auto',
			// The first step is a bottom sheet on a phone (V1 menus review, 17 Oct): two
			// choices under the thumb, with the page still showing above. Full screen, it
			// was two cards at the top of an empty white page. The upload and review steps
			// need the room, so they still take the whole screen.
			step === 'choose'
				? 'max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[85dvh] max-sm:rounded-none max-sm:rounded-t-2xl max-sm:pb-[max(1rem,env(safe-area-inset-bottom))]'
				: 'max-sm:inset-0 max-sm:top-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:rounded-none'
		)}
	>
		{#if step === 'choose'}
			<Dialog.Header>
				<Dialog.Title>{$t('create_dialog.title')}</Dialog.Title>
				<Dialog.Description>{$t('create_dialog.subtitle')}</Dialog.Description>
			</Dialog.Header>
			<div class="flex min-w-0 flex-col gap-3 sm:flex-row">
				<a href="/create" class={optionClass} onclick={() => (createDialog.open = false)}>
					<span class={optionIcon}><PencilLine class="size-5" aria-hidden="true" /></span>
					<span class="text-base font-semibold">{$t('create_dialog.scratch')}</span>
					<span class="text-muted-foreground text-sm"
						>{$t('create_dialog.scratch_hint')}</span
					>
				</a>
				{#if $signedIn || page.data.anonymousQuizzes === true}
					<button type="button" class={optionClass} onclick={() => (step = 'upload')}>
						<span class={optionIcon}
							><FileSpreadsheet class="size-5" aria-hidden="true" /></span
						>
						<span class="text-base font-semibold">{$t('create_dialog.import')}</span>
						<span class="text-muted-foreground text-sm"
							>{$t('create_dialog.import_hint')}</span
						>
					</button>
				{:else if page.data.anonymousQuizzes === null}
					<RetryNotice
						message="Quiz import is temporarily unavailable. Please try again."
					/>
				{:else}
					<a href={login_href} class={optionClass}>
						<span class={optionIcon}
							><FileSpreadsheet class="size-5" aria-hidden="true" /></span
						>
						<span class="text-base font-semibold"
							>{$t('create_dialog.sign_in_to_import')}</span
						>
						<span class="text-muted-foreground text-sm"
							>{$t('create_dialog.import_hint')}</span
						>
					</a>
				{/if}
			</div>
		{:else if step === 'upload' || step === 'checking'}
			<Dialog.Header>
				<Dialog.Title>{$t('create_dialog.import')}</Dialog.Title>
				<Dialog.Description>{$t('create_dialog.import_hint')}</Dialog.Description>
			</Dialog.Header>

			<label
				class={cn(
					'border-border text-muted-foreground focus-within:ring-ring flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors focus-within:ring-2',
					dragging && 'border-foreground/50 bg-muted/60',
					step === 'checking' && 'pointer-events-none opacity-70'
				)}
				ondragover={(e) => {
					e.preventDefault();
					dragging = true;
				}}
				ondragleave={() => (dragging = false)}
				ondrop={(e) => {
					e.preventDefault();
					dragging = false;
					choose(e.dataTransfer?.files[0]);
				}}
			>
				<input
					type="file"
					accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
					class="sr-only"
					disabled={step === 'checking'}
					onchange={(e) => choose(e.currentTarget.files?.[0])}
				/>
				{#if step === 'checking'}
					<LoaderCircle class="size-7 animate-spin" aria-hidden="true" />
					<span class="text-foreground font-medium" role="status"
						>{$t('create_dialog.checking')}</span
					>
				{:else}
					<Upload class="size-7" aria-hidden="true" />
					<!-- A phone has nothing to drop and nothing to click: say "choose" there. -->
					<span class="text-foreground text-base font-medium pointer-coarse:hidden"
						>{$t('create_dialog.drop_title')}</span
					>
					<span class="text-sm pointer-coarse:hidden"
						>{$t('create_dialog.drop_hint')}</span
					>
					<span class="text-foreground hidden text-base font-medium pointer-coarse:inline"
						>{$t('create_dialog.choose_title')}</span
					>
					<span class="hidden text-sm pointer-coarse:inline"
						>{$t('create_dialog.choose_hint')}</span
					>
				{/if}
			</label>

			{#if problem}
				<p class="text-destructive flex items-start gap-2 text-sm" role="alert">
					<CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
					{problem}
				</p>
			{/if}

			<Dialog.Footer class="shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-between">
				<Button
					variant="ghost"
					onclick={() => (step = 'choose')}
					disabled={step === 'checking'}
				>
					<ArrowLeft aria-hidden="true" />
					{$t('create_dialog.back')}
				</Button>
				<Button variant="outline" href="/api/v1/quiz/excel-template" download>
					<Download aria-hidden="true" />
					{$t('create_dialog.download_template')}
				</Button>
			</Dialog.Footer>
		{:else if preview}
			<Dialog.Header>
				<Dialog.Title class="break-words">
					{clean
						? preview.title
						: $t('create_dialog.fix_title', { count: preview.errors.length })}
				</Dialog.Title>
				<Dialog.Description>
					{clean
						? $t('create_dialog.ready_count', { count: preview.questions.length })
						: $t('create_dialog.fix_hint')}
				</Dialog.Description>
			</Dialog.Header>

			{#if !clean}
				<ul
					class="bg-destructive/5 ring-destructive/20 flex max-h-56 min-w-0 flex-col gap-2 overflow-y-auto rounded-xl p-4 ring-1"
					role="alert"
				>
					{#each preview.errors as error, i (i)}
						<li class="flex min-w-0 items-start gap-2 text-sm">
							<CircleAlert
								class="text-destructive mt-0.5 size-4 shrink-0"
								aria-hidden="true"
							/>
							<span class="min-w-0 break-words">{describeError(error)}</span>
						</li>
					{/each}
				</ul>
				{#if preview.questions.length > 0}
					<p class="text-muted-foreground -mt-2 text-sm">
						{$t('create_dialog.fine_questions')}
					</p>
				{/if}
			{/if}

			{#if preview.questions.length > 0}
				<p class="text-muted-foreground text-sm">{$t('create_dialog.review_hint')}</p>
				<ol
					bind:this={questionList}
					onscroll={updateScroll}
					class="border-border divide-border min-h-0 min-w-0 divide-y overflow-y-scroll rounded-xl border max-sm:flex-1 sm:max-h-[55dvh]"
					style="scrollbar-gutter: stable; scrollbar-color: #909098 transparent;"
				>
					{#each preview.questions as q, index (q.row)}
						<li class="min-w-0">
							<details class="group">
								<summary
									class="hover:bg-muted/50 focus-visible:ring-ring flex cursor-pointer list-none items-start gap-3 p-3 outline-none focus-visible:ring-2 [&::-webkit-details-marker]:hidden"
								>
									<span
										class="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums"
										>{index + 1}</span
									>
									<span class="min-w-0 flex-1">
										<span class="block text-sm font-medium break-words"
											>{q.question}</span
										>
										<span class="text-muted-foreground mt-1 block text-xs"
											>{$t('create_dialog.answers_count', {
												count: q.answers.length
											})} · {$t('create_dialog.seconds', {
												count: q.time
											})}</span
										>
									</span>
									<ChevronDown
										class="text-muted-foreground mt-1 size-4 shrink-0 transition-transform group-open:rotate-180"
										aria-hidden="true"
									/>
								</summary>
								<div class="bg-muted/30 px-3 pb-4 pt-2 sm:pl-13">
									<p class="text-muted-foreground mb-2 text-xs">
										{$t(`create_dialog.type_${q.type}`)} · {$t(
											'create_dialog.source_row',
											{ row: q.row }
										)}
									</p>
									<ul class="flex min-w-0 flex-col gap-2 text-sm">
										{#each q.answers as a, i (i)}
											<li class="flex min-w-0 items-start gap-2">
												{#if a.right}<Check
														class="mt-0.5 size-4 shrink-0"
														aria-label="Correct"
													/>{:else}<span
														class="size-4 shrink-0"
														aria-hidden="true"
													></span>{/if}
												<span
													class={cn(
														'min-w-0 break-words',
														!a.right && 'text-muted-foreground'
													)}>{a.text}</span
												>
											</li>
										{/each}
									</ul>
								</div>
							</details>
						</li>
					{/each}
				</ol>
				{#if preview.questions.length > 5}
					<div class="flex shrink-0 items-center justify-between gap-2">
						<p class="text-muted-foreground text-xs" role="status">
							{$t(atEnd ? 'create_dialog.end_list' : 'create_dialog.scroll_hint', {
								count: preview.questions.length
							})}
						</p>
						<Button
							variant="ghost"
							size="sm"
							onclick={() =>
								questionList?.scrollTo({
									top: atEnd ? 0 : questionList.scrollHeight,
									behavior: 'smooth'
								})}
							>{$t(
								atEnd
									? 'create_dialog.first_question'
									: 'create_dialog.last_question'
							)}</Button
						>
					</div>
				{/if}
			{/if}

			{#if problem}
				<p class="text-destructive flex items-start gap-2 text-sm" role="alert">
					<CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
					{problem}
				</p>
			{/if}

			<Dialog.Footer class="shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-between">
				<Button variant={clean ? 'ghost' : 'default'} onclick={again} disabled={creating}>
					{$t('create_dialog.choose_another')}
				</Button>
				{#if clean}
					<Button onclick={create} disabled={creating}>
						{#if creating}
							<LoaderCircle class="animate-spin" aria-hidden="true" />
							{$t('create_dialog.creating')}
						{:else}
							{$t('create_dialog.create')}
						{/if}
					</Button>
				{/if}
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
