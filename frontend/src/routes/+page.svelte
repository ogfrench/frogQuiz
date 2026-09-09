<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { goto } from '$app/navigation';
	import { navbarVisible } from '$lib/stores.svelte.ts';
	import { signedIn } from '$lib/stores';
	import { getLocalization } from '$lib/i18n';
	import Footer from '$lib/footer.svelte';
	import Wordmark from '$lib/components/Wordmark.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import JpgOpenGraph from '$lib/assets/landing/opengraph-home.jpg';
	import WebPOpenGraph from '$lib/assets/landing/opengraph-home.webp';

	const { t } = getLocalization();
	navbarVisible.visible = true;

	let pin = $state('');
	let ready = $derived(pin.trim().length === 6);

	const join = (e: Event) => {
		e.preventDefault();
		if (!ready) return;
		goto(`/play?pin=${encodeURIComponent(pin.trim())}`);
	};
</script>

<svelte:head>
	<title>frogQuiz - {$t('index_page.meta.title')}</title>
	<meta name="description" content={$t('index_page.meta.description')} />

	<meta property="og:url" content="https://frogquiz.xyz/" />
	<meta property="og:type" content="website" />
	<meta property="og:title" content="frogQuiz - {$t('index_page.meta.title')}" />
	<meta property="og:description" content={$t('index_page.meta.description')} />
	<meta property="og:image" content={JpgOpenGraph} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta property="twitter:domain" content="frogquiz.xyz" />
	<meta property="twitter:url" content="https://frogquiz.xyz/" />
	<meta name="twitter:title" content="frogQuiz - {$t('index_page.meta.title')}" />
	<meta name="twitter:description" content={$t('index_page.meta.description')} />
	<meta name="twitter:image" content={WebPOpenGraph} />
</svelte:head>

<div class="flex min-h-screen flex-col">
	<main class="flex flex-1 items-center justify-center px-6 py-24">
		<div class="w-full max-w-md">
			<div class="flex flex-col items-center text-center">
				<Wordmark size={56} showText={false} />
				<h1 class="mt-7 text-4xl font-medium tracking-[-0.04em] sm:text-5xl">frogQuiz</h1>
			</div>

			<form
				onsubmit={join}
				class="border-border/70 bg-card mt-12 rounded-2xl border p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-24px_rgba(0,0,0,0.25)]"
			>
				<Label for="game-pin" class="text-sm font-medium">{$t('words.game_pin')}</Label>
				<p class="text-muted-foreground mt-1.5 text-sm">
					{$t('index_page.join_prompt')}
				</p>
				<div class="mt-4 flex gap-2">
					<Input
						id="game-pin"
						bind:value={pin}
						maxlength={6}
						inputmode="numeric"
						autocomplete="off"
						placeholder="000000"
						class="h-11 text-center font-mono text-lg tracking-[0.35em]"
					/>
					<Button type="submit" size="lg" disabled={!ready} class="h-11 px-5">
						{$t('words.join')}
					</Button>
				</div>
			</form>

			<div class="text-muted-foreground mt-8 text-center text-sm">
				<span>{$t('index_page.hosting')}</span>
				<a
					href={$signedIn ? '/dashboard' : '/account/login?returnTo=/dashboard'}
					class="text-foreground ml-1 inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
				>
					{$t('index_page.host_cta')}
					<ArrowRight class="size-3.5" aria-hidden="true" />
				</a>
			</div>
		</div>
	</main>
	<Footer />
</div>
