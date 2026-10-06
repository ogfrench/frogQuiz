<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { getLocalization } from '$lib/i18n';
	import { signedIn } from '$lib/stores';
	import { beforeNavigate } from '$app/navigation';
	import Wordmark from '$lib/components/Wordmark.svelte';
	import ThemeToggle from '$lib/theme-toggle.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import UserAvatar from '$lib/components/UserAvatar.svelte';
	import Menu from '@lucide/svelte/icons/menu';
	import { page } from '$app/state';
	import { building } from '$app/environment';

	const { t } = getLocalization();

	// A real "you are here". Play used to be drawn permanently highlighted, which read
	// as the current page on every page.
	const is_current = (href: string) =>
		page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	// Between 768 and 1024 the bar has little to spare, and links wrapped onto two lines
	// rather than shrink. They never wrap now, and pad a little less there.
	const link = 'btn-nav whitespace-nowrap md:max-lg:px-2';
	const nav_class = (href: string) =>
		is_current(href) ? `${link} bg-muted text-foreground` : link;
	// The drawer's rows: the same "you are here", sized for a thumb rather than a cursor.
	const row_class = (href: string) =>
		`flex min-h-12 items-center gap-3 rounded-md px-3 text-base font-medium transition-colors hover:bg-muted ${
			is_current(href)
				? 'bg-muted text-foreground'
				: 'text-muted-foreground hover:text-foreground'
		}`;

	// The three surfaces, the same whether or not you are signed in (MVP.md section 1).
	const surfaces = [
		{ href: '/explore', key: 'words.discover' },
		{ href: '/my-quizzes', key: 'words.my_quizzes' },
		{ href: '/play', key: 'words.join' }
	];

	// One way in. Log in and Register used to sit side by side, in both navbars. Making a
	// quiz needs no account (MVP.md D4), so the thing a newcomer is here to do is Create,
	// not Register, and the login page links to registration for the few who want one.
	// From the router, not the `pathname` store this used to read: that was set once at
	// app load and never again, so landing on / and browsing to a quiz still sent you
	// back to / after logging in. On the account pages themselves, pass on whatever
	// returnTo is already there rather than pointing back at the login form.
	// While prerendering (the legal pages are static files) SvelteKit forbids reading the
	// query string at all, and reading it here failed the whole production build. A
	// prerendered page has no query to carry, so its link is built from the path alone.
	const login_href = $derived.by(() => {
		const here = page.url.pathname;
		if (building) return `/account/login?returnTo=${encodeURIComponent(here)}`;
		if (here.startsWith('/account/')) {
			const kept = page.url.searchParams.get('returnTo');
			return kept ? `/account/login?returnTo=${encodeURIComponent(kept)}` : '/account/login';
		}
		return `/account/login?returnTo=${encodeURIComponent(here + page.url.search)}`;
	});

	// The avatar's letter. The session token carries only the email, so the username is
	// asked for once, when the bar first sees a signed-in user; the bar outlives client
	// navigation, and logging out is a full page load that starts it over.
	let username = $state<string | null>(null);
	$effect(() => {
		if (!$signedIn || username !== null) return;
		fetch('/api/v1/users/me')
			.then((r) => (r.ok ? r.json() : null))
			.then((u) => (username = u?.username ?? ''))
			.catch(() => (username = ''));
	});

	let menuOpen = $state(false);
	beforeNavigate(() => {
		menuOpen = false; // Closes the drawer to let the user see the page beneath
	});
</script>

<!-- h-16, not py-3: the 44px touch-sized row plus padding made the bar 69px over a 64px
     spacer, so every page's first 5px sat under it. 64 is what the spacer and the
     100dvh - 4rem pages assume. Named because the footer has a nav of its own. -->
<nav
	aria-label="Main"
	class="border-border/60 bg-background/80 fixed inset-x-0 top-0 z-30 flex h-16 items-center border-b px-5 backdrop-blur-xl [clip-path:inset(0)] lg:px-8"
>
	<div class="flex w-full items-center justify-between gap-4">
		<div class="flex min-w-0 items-center gap-1">
			<a
				href="/"
				class="fq-touch-target text-foreground hover:opacity-80 relative mr-2 flex min-h-11 shrink-0 items-center text-lg transition-opacity"
				aria-label="frogQuiz home"
			>
				<Wordmark />
			</a>
			<!-- Discover is /explore, which also serves /search. -->
			<div class="hidden items-center gap-1 md:flex">
				{#each surfaces as s (s.href)}
					<a
						class={nav_class(s.href)}
						href={s.href}
						aria-current={is_current(s.href) ? 'page' : undefined}>{$t(s.key)}</a
					>
				{/each}
			</div>
			<!-- Docs and GitHub hidden for the MVP (MVP.md §4.2), for signed-out visitors
			     only as before. To bring them back, restore under {#if !$signedIn}:
			     <a class="btn-nav" href="/docs">{$t('words.docs')}</a> and an external link
			     to https://github.com/ogfrench/frogQuiz with the ExternalLink icon. -->
		</div>

		<!-- Desktop: theme, Log in or your avatar, then the one button. -->
		<div class="hidden items-center gap-1 md:flex">
			<ThemeToggle />
			{#if $signedIn}
				<!-- A circle with your initial that takes you to My Account, where Log out
				     lives (François, 2026-10-03). It was a "My Account" menu holding settings
				     and Log out; before that, two links side by side (MVP.md §4.2). -->
				<a
					href="/account/settings"
					class="fq-touch-target focus-visible:ring-ring relative ml-1 inline-flex rounded-full focus-visible:ring-2 focus-visible:outline-none"
					aria-label={$t('words.my_account')}
					title={$t('words.my_account')}
					aria-current={is_current('/account/settings') ? 'page' : undefined}
				>
					<UserAvatar
						name={username}
						class="size-8 text-sm transition-shadow hover:ring-2 hover:ring-ring/40 {is_current(
							'/account/settings'
						)
							? 'ring-2 ring-ring/60'
							: ''}"
					/>
				</a>
			{:else}
				<a class={nav_class('/account/login')} href={login_href}>{$t('words.login')}</a>
			{/if}
			<!-- Outline, not filled: the page under the navbar owns the one loud button. -->
			<Button href="/create" variant="outline" size="sm" class="ml-1">
				{$t('index_page.create_cta')}
			</Button>
		</div>

		<!-- Phone and small tablet. Join stays out of the drawer because it is what most
		     people on a phone are here for, and hiding the only item they want behind a
		     menu is what costs discoverability (NN/g, "combo navigation"). It sits with the
		     menu button rather than in the middle of the bar, where it read as stranded. -->
		<div class="flex items-center gap-2 md:hidden">
			<Button
				href="/play"
				variant="secondary"
				size="sm"
				aria-current={is_current('/play') ? 'page' : undefined}>{$t('words.join')}</Button
			>
			<Sheet.Root bind:open={menuOpen}>
				<Sheet.Trigger
					class="fq-touch-target text-muted-foreground hover:text-foreground hover:bg-muted relative inline-flex size-9 shrink-0 items-center justify-center rounded-md transition-colors"
					aria-label={$t('navbar.open_menu')}
				>
					<Menu class="size-6" aria-hidden="true" />
				</Sheet.Trigger>
				<!-- Opaque and full height. It used to slide open inside the translucent
				     navbar, so the page showed through it and a heading was cut in half
				     beneath the last row. -->
				<Sheet.Content side="right" class="bg-background w-[85%] max-w-sm gap-0 p-0">
					<Sheet.Header
						class="border-border/60 flex h-16 flex-row items-center border-b px-5"
					>
						<Sheet.Title class="sr-only">{$t('navbar.menu')}</Sheet.Title>
						<a
							href="/"
							class="fq-touch-target text-foreground relative flex items-center text-lg"
							aria-label="frogQuiz home"
						>
							<Wordmark />
						</a>
					</Sheet.Header>

					<div class="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
						{#each surfaces as s (s.href)}
							<a
								class={row_class(s.href)}
								href={s.href}
								aria-current={is_current(s.href) ? 'page' : undefined}
								>{$t(s.key)}</a
							>
						{/each}

						<div class="bg-border my-2 h-px" role="separator"></div>

						{#if $signedIn}
							<!-- Log out is on the account page, as on desktop. -->
							<a
								class={row_class('/account/settings')}
								href="/account/settings"
								aria-current={is_current('/account/settings') ? 'page' : undefined}
							>
								<UserAvatar name={username} class="size-7 text-xs" />
								{$t('words.my_account')}
							</a>
						{:else}
							<a class={row_class('/account/login')} href={login_href}
								>{$t('words.login')}</a
							>
						{/if}
					</div>

					<!-- The one action, at the foot of the drawer where a thumb rests, instead of
					     an outline button wedged between a divider and Log in. -->
					<div class="border-border/60 flex flex-col gap-3 border-t p-4">
						<div class="flex items-center justify-between">
							<span class="text-muted-foreground text-sm">{$t('navbar.theme')}</span>
							<ThemeToggle />
						</div>
						<Button href="/create" size="lg" class="w-full">
							{$t('index_page.create_cta')}
						</Button>
					</div>
				</Sheet.Content>
			</Sheet.Root>
		</div>
	</div>
</nav>
