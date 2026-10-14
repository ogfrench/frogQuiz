<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	// Right after sign-in, offers to keep the quizzes this browser made without an account.
	// Asked, never done by itself: on a shared laptop they may be somebody else's (#43).
	import { page } from '$app/state';
	import { getLocalization } from '$lib/i18n';
	import { claimQuizzes, anonQuizIds, loadAnonQuiz, takeJustSignedIn } from '$lib/anon_quiz';
	import { htmlToPlainText } from '$lib/sanitize';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';

	let { active }: { active: boolean } = $props();
	const { t } = getLocalization();

	let open = $state(false);
	let quizzes: { id: string; title: string }[] = $state([]);
	let username = $state('');
	let keeping = $state(false);
	let summary: string | null = $state(null);
	let checked = false;
	let cancelButton = $state<HTMLButtonElement | null>(null);

	$effect(() => {
		// Waits for a page with the navbar: never over a game or the editor.
		if (checked || !active || !page.data.loggedIn) return;
		checked = true;
		if (takeJustSignedIn()) void offer();
	});

	async function offer() {
		const found = (await Promise.all(anonQuizIds().map((id) => loadAnonQuiz(id)))).filter(
			(q) => q !== null
		);
		if (found.length === 0) return;
		// The quiz's own page already has Claim for it, open.
		if (
			found.length === 1 &&
			page.route.id === '/view/[quiz_id]' &&
			page.params.quiz_id === found[0].id
		)
			return;
		try {
			username = (await (await fetch('/api/v1/users/me')).json()).username ?? '';
		} catch {
			return;
		}
		quizzes = found.map((q) => ({ id: q.id, title: htmlToPlainText(q.title) }));
		open = true;
	}

	async function keepAll() {
		if (keeping) return;
		keeping = true;
		const result = await claimQuizzes(quizzes.map((quiz) => quiz.id));
		keeping = false;
		if (result.claimed.length === quizzes.length) {
			window.location.reload();
			return;
		}
		summary = $t('claim_prompt.kept_some', {
			kept: result.claimed.length,
			total: quizzes.length
		});
		if (result.gone.length) summary += ' ' + $t('claim.gone');
		if (result.stopped) summary += ' ' + $t(`claim_prompt.${result.stopped}`);
	}
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Content class="max-w-md gap-5 text-left" onOpenAutoFocus={(event) => { event.preventDefault(); cancelButton?.focus(); }}>
		<AlertDialog.Header class="place-items-start gap-2 text-left">
			<AlertDialog.Title class="pr-2 text-left text-xl leading-snug"
				>{$t('claim_prompt.title', { count: quizzes.length })}</AlertDialog.Title
			>
			<AlertDialog.Description class="text-left leading-relaxed">
				{$t('claim_prompt.body', { username })}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<ul class="border-border bg-muted/30 text-foreground max-h-48 divide-y overflow-y-auto rounded-xl border text-sm">
			{#each quizzes as quiz (quiz.id)}
				<li class="px-4 py-3 text-left font-medium break-words">{quiz.title}</li>
			{/each}
		</ul>
		{#if summary}
			<p class="text-sm" role="status">{summary}</p>
		{/if}
		<AlertDialog.Footer>
			{#if summary}
				<Button onclick={() => window.location.reload()}>{$t('claim_prompt.done')}</Button>
			{:else}
				<AlertDialog.Cancel bind:ref={cancelButton} disabled={keeping}
					>{$t('claim_prompt.not_now')}</AlertDialog.Cancel
				>
				<!-- A plain Button, not AlertDialog.Action, so the dialog stays open to report. -->
				<Button disabled={keeping} onclick={keepAll}>
					{#if keeping}
						<LoaderCircle class="animate-spin" aria-hidden="true" />
					{/if}
					{keeping ? $t('claim_prompt.keeping') : $t('claim_prompt.keep_all')}
				</Button>
			{/if}
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

