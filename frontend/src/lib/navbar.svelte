<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { getLocalization } from '$lib/i18n';
	import { signedIn, pathname } from '$lib/stores';
	import { createTippy } from 'svelte-tippy';
	import BrownButton from '$lib/components/buttons/brown.svelte';
	import { browser } from '$app/environment';
	import { beforeNavigate } from '$app/navigation';
	import { slide } from 'svelte/transition';
	import { registration_disabled } from './config';
	import Wordmark from '$lib/components/Wordmark.svelte';
	import Sun from '@lucide/svelte/icons/sun';
	import Moon from '@lucide/svelte/icons/moon';
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';
	import ExternalLink from '@lucide/svelte/icons/external-link';

	const tippy = createTippy({
		arrow: true,
		animation: 'perspective-subtle',
		placement: 'bottom'
	});

	const { t } = getLocalization();

	let menuIsClosed = $state(true);
	const toggleMenu = () => {
		menuIsClosed = !menuIsClosed;
	};

	beforeNavigate(() => {
		menuIsClosed = true; // Closes menu to let the user see the page beneath
	});

	let darkMode = $state(false);
	if (browser) {
		darkMode =
			localStorage.theme === 'dark' ||
			(!('theme' in localStorage) &&
				window.matchMedia('(prefers-color-scheme: dark)').matches);
	}

	const switchDarkMode = () => {
		!darkMode ? localStorage.setItem('theme', 'dark') : localStorage.setItem('theme', 'light');
		window.location.reload();
	};
</script>

<nav
	class="border-border/60 bg-background/80 fixed inset-x-0 top-0 z-30 border-b px-5 py-3 backdrop-blur-xl lg:px-8"
>
	<!-- Desktop navbar -->
	<div class="hidden lg:flex lg:items-center lg:flex-row lg:justify-between">
		<div class="lg:flex lg:items-center lg:flex-row gap-1">
			<a
				href="/"
				class="text-foreground hover:opacity-80 mr-2 flex items-center text-lg transition-opacity"
				aria-label="frogQuiz home"
			>
				<Wordmark />
			</a>
			<a class="btn-nav border-border bg-muted/60 text-foreground border" href="/play">{$t('words.play')}</a>
			<a class="btn-nav" href="/explore">{$t('words.explore')}</a>
			<a class="btn-nav" href="/search">{$t('words.search')}</a>
			{#if $signedIn}
				<a class="btn-nav" href="/dashboard">{$t('words.dashboard')}</a>
			{:else}
				<a class="btn-nav" href="/docs">{$t('words.docs')}</a>
				<a
					target="_blank"
					class="btn-nav flex items-center gap-1"
					href="https://github.com/ogfrench/frogQuiz"
					>GitHub
					<ExternalLink class="size-4" aria-hidden="true" />
				</a>
			{/if}
		</div>
		<div class="lg:flex lg:items-center lg:flex-row gap-1">
			{#if $signedIn}
				<a class="btn-nav" href="/api/v1/users/logout">{$t('words.logout')}</a>
			{:else}
				{#if registration_disabled}
					<a class="btn-nav" href="/account/register">{$t('words.register')}</a>
				{/if}

				<a class="btn-nav" href="/account/login?returnTo={$pathname}">{$t('words.login')}</a
				>
			{/if}

			<div class="fit-content flex items-center justify-center gap-2">
				<div class="lg:flex items-center justify-center">
					{#if darkMode}
						<button
							onclick={() => {
								switchDarkMode();
							}}
							use:tippy={{ content: 'Switch light mode on' }}
							aria-label="Activate light mode"
						>
							<Sun class="size-5" aria-hidden="true" />
						</button>
					{:else}
						<button
							onclick={() => {
								switchDarkMode();
							}}
							aria-label="Activate darkmode"
							use:tippy={{ content: 'Switch dark mode on' }}
						>
							<Moon class="size-5" aria-hidden="true" />
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Mobile navbar -->
	<div class="lg:hidden">
		<!-- Navbar header -->
		<div class="flex items-center justify-between">
			<a
				href="/"
				class="text-foreground hover:opacity-80 mr-2 flex items-center text-lg transition-opacity"
				aria-label="frogQuiz home"
			>
				<Wordmark />
			</a>
			<a class="btn-nav flex" href="/play">{$t('words.play')}</a>

			<!-- Dark/Light mode toggle + Open/Close menu -->
			<div class="flex items-center">
				{#if darkMode}
					<!-- Sun icon -->
					<button
						class="px-3"
						onclick={() => {
							switchDarkMode();
						}}
						use:tippy={{ content: 'Switch light mode on' }}
						aria-label="Activate light mode"
					>
						<Sun class="size-5" aria-hidden="true" />
					</button>
				{:else}
					<!-- Moon icon -->
					<button
						class="px-3"
						onclick={() => {
							switchDarkMode();
						}}
						aria-label="Activate darkmode"
						use:tippy={{ content: 'Switch dark mode on' }}
					>
						<Moon class="size-5" aria-hidden="true" />
					</button>
				{/if}

				{#if menuIsClosed}
					<button
						class="px-3"
						id="open-menu"
						onclick={toggleMenu}
						aria-label="Open navbar"
					>
						<Menu class="size-6" aria-hidden="true" />
					</button>
				{:else}
					<button
						class="px-3"
						id="close-menu"
						onclick={toggleMenu}
						aria-label="Close navbar"
					>
						<X class="size-6" aria-hidden="true" />
					</button>
				{/if}
			</div>
		</div>

		<!-- Navbar content -->
		{#if !menuIsClosed}
			<div class="flex flex-col" transition:slide|global={{ duration: 400 }}>
				<a class="btn-nav" href="/explore">{$t('words.explore')}</a>
			<a class="btn-nav" href="/search">{$t('words.search')}</a>
				{#if $signedIn}
					<a class="btn-nav" href="/dashboard">{$t('words.dashboard')}</a>
				{:else}
					<a class="btn-nav" href="/docs">{$t('words.docs')}</a>
					<a
						target="_blank"
						class="btn-nav flex items-center gap-1"
						href="https://github.com/ogfrench/frogQuiz"
						>GitHub
						<ExternalLink class="size-4" aria-hidden="true" />
					</a>
				{/if}

				<hr class="my-1 border" />
				{#if $signedIn}
					<a class="btn-nav" href="/api/v1/users/logout">{$t('words.logout')}</a>
				{:else}
					{#if registration_disabled}
						<a class="btn-nav" href="/account/register">{$t('words.register')}</a>
					{/if}

					<a class="btn-nav" href="/account/login?returnTo={$pathname}"
						>{$t('words.login')}</a
					>
				{/if}


			</div>
		{/if}
	</div>
</nav>
