<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	// Quizzes made without an account are only findable through the secret in
	// this browser's localStorage. Without a list, the only record of one is the
	// tab it was created in: close it and the quiz is unreachable until the
	// 30-day sweep removes it.
	import { onMount } from 'svelte';
	import { getLocalization } from '$lib/i18n';
	import { navbarVisible } from '$lib/stores.svelte.ts';
	import { anonQuizIds, clearAnonSecret } from '$lib/anon_quiz';
	import Spinner from '$lib/Spinner.svelte';

	const { t } = getLocalization();
	navbarVisible.visible = true;

	interface DeviceQuiz {
		id: string;
		title: string;
		expire_at: string | null;
	}

	let quizzes: DeviceQuiz[] = $state([]);
	let loading = $state(true);

	const daysLeft = (expire_at: string | null): number | null =>
		expire_at === null
			? null
			: Math.max(0, Math.ceil((new Date(expire_at).getTime() - Date.now()) / 86400000));

	onMount(async () => {
		const found: DeviceQuiz[] = [];
		for (const id of anonQuizIds()) {
			try {
				const res = await fetch(`/api/v1/quiz/get/public/${id}`);
				if (res.status === 404) {
					// Expired and swept, or deleted elsewhere. Drop the dead
					// secret so the list doesn't keep retrying it forever.
					clearAnonSecret(id);
					continue;
				}
				if (!res.ok) continue;
				const quiz = await res.json();
				found.push({ id, title: quiz.title, expire_at: quiz.expire_at });
			} catch {
				// Offline or the API is down: keep the secret, just show less.
			}
		}
		quizzes = found;
		loading = false;
	});
</script>

<svelte:head>
	<title>frogQuiz - {$t('device_quizzes.title')}</title>
</svelte:head>

<div class="mx-auto w-full max-w-2xl px-4 py-10">
	<h1 class="marck-script text-3xl">{$t('device_quizzes.title')}</h1>
	<p class="mt-2 text-sm text-muted-foreground">{$t('device_quizzes.explainer')}</p>

	{#if loading}
		<div class="mt-10 flex justify-center"><Spinner /></div>
	{:else if quizzes.length === 0}
		<div class="mt-8 rounded-xl border border-border bg-muted/40 p-6 text-center">
			<p class="text-muted-foreground">{$t('device_quizzes.empty')}</p>
			<a
				class="mt-4 inline-block rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90"
				href="/create?anon=true"
			>
				{$t('device_quizzes.create')}
			</a>
		</div>
	{:else}
		<ul class="mt-8 flex flex-col gap-3">
			{#each quizzes as quiz (quiz.id)}
				{@const days = daysLeft(quiz.expire_at)}
				<li class="rounded-xl border border-border bg-card p-4">
					<a class="flex flex-col gap-1" href="/view/{quiz.id}">
						<span class="min-w-0 truncate font-medium">{quiz.title}</span>
						{#if days !== null}
							<span class="text-sm text-muted-foreground">
								{$t('device_quizzes.expires', { count: days })}
							</span>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
		<p class="mt-6 text-sm text-muted-foreground">{$t('device_quizzes.keep_hint')}</p>
	{/if}
</div>
