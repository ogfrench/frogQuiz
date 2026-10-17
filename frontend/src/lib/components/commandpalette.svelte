<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<!--
This should be okay, right?
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { tinykeys } from '$lib/tinykeys';
	import { fade } from 'svelte/transition';
	import MiniSearch from 'minisearch';

	let open = $state(false);
	let input = $state('');
	let bg_text = $state('');
	let title_ms: MiniSearch;
	let command_ms: MiniSearch;
	let selected: null | number = $state(null);

	// eslint-disable-next-line no-unused-vars
	type ActionFunction = (args: string[]) => void;
	const actions: {
		id: number;
		title: string;
		description?: string;
		command?: string;
		args?: string[];
		action: ActionFunction;
	}[] = [
		{
			id: 0,
			title: 'Close',
			description: 'Close this palette',
			command: 'close',
			action: () => close_cp(undefined)
		},
		{
			id: 1,
			title: 'Create a quiz',
			description: 'Open the editor on a new quiz',
			command: 'newquiz',
			args: ['title'],
			action: (args) => window.location.assign(`/create?title=${args.join(' ')}`)
		},
		// id 2: Import (/import) is hidden for the MVP (MVP.md D6).
		// id 4: Results (/results) is hidden for the MVP (MVP.md D4).
		{
			id: 5,
			title: 'Discover',
			description: 'Browse and search quizzes',
			command: 'explore',
			action: () => window.location.assign('/explore')
		},
		{
			id: 6,
			title: 'My quizzes',
			description: 'Your quizzes, and the ones made on this browser',
			command: 'quizzes',
			action: () => window.location.assign('/my-quizzes')
		},
		// id 7, Docs (/docs), is hidden for the MVP along with the page (MVP.md §4.2).
		{
			id: 8,
			title: 'My account',
			description: 'Your account, sessions and sign-out',
			command: 'settings',
			action: () => window.location.assign('/account/settings')
		}
	];
	let visible_items = $state(actions);

	// Focus goes to the field when the palette opens and back where it was when it closes.
	// `autofocus` was not enough: Svelte 5 honours it only while <body> has the focus, so
	// Ctrl+K from a focused link left the typing going to the page behind.
	let before: HTMLElement | null = null;
	const grab_focus = (node: HTMLInputElement) => {
		before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		node.focus();
		return {
			destroy() {
				before?.focus({ preventScroll: true });
				before = null;
			}
		};
	};

	const toggle_open = (e: KeyboardEvent | undefined) => {
		e.preventDefault();
		open = !open;
	};

	// Every binding below is on `window` for the life of the app, so each one has to
	// stand down while the palette is closed. They did not: Tab and the arrow keys called
	// preventDefault on every page, so focus could never leave <body> and the arrows
	// could not scroll, and Enter ran whichever action had last been selected.
	const close_cp = (e: KeyboardEvent | undefined) => {
		if (!open) return;
		if (e) {
			e.preventDefault();
		}
		open = false;
	};

	const close_on_outside = (e: Event) => {
		if (e.target == e.currentTarget) {
			open = false;
		}
	};

	const execute_action = () => {
		let args = [];
		const entry = visible_items[selected];
		if (input.startsWith('/')) {
			const tokens = input.split(' ');
			args = tokens.slice(1);
		}
		console.log(args);
		entry.action(args);
	};

	const search = (term: string) => {
		if (!command_ms || !title_ms) {
			return;
		}
		if (term === '' || term === '/') {
			selected = 0;
			visible_items = actions;
			bg_text = '';
			return;
		}
		let suggestions;
		let res;
		if (term.startsWith('/')) {
			term = term.substring(1);
			suggestions = command_ms.autoSuggest(term, { boost: { command: 2 }, prefix: true });
			res = command_ms.search(term, { boost: { command: 2 }, prefix: true });
			bg_text = suggestions[0]?.suggestion;
			bg_text ??= '';
			bg_text = `/${bg_text}`;
		} else {
			suggestions = title_ms.autoSuggest(term, { boost: { command: 2 }, prefix: true });
			res = title_ms.search(term, { boost: { command: 2 }, prefix: true });
			bg_text = suggestions[0]?.suggestion;
			bg_text ??= '';
		}

		visible_items = [];

		// MiniSearch returns the `id` each action was indexed under, not its position in
		// this array -- and the ids are 0, 1, 5, 6, 8 since four actions were removed. So
		// `actions[id]` was undefined for every search hit: the list came back empty and
		// rendering it threw on `.args`. Look the action up by its id.
		for (const quiz_data of res) {
			const action = actions.find((a) => a.id === quiz_data.id);
			if (action) visible_items.push(action);
		}
		visible_items = visible_items;
		if (visible_items.length === 1) {
			selected = 0;
		}
		if (visible_items.length === 0) {
			selected = null;
		}
	};

	const autocomplete_on_tab = (e: KeyboardEvent) => {
		if (!open) return;
		e.preventDefault();
		input = bg_text;
	};

	const on_arrow_down = (e: KeyboardEvent) => {
		if (!open) return;
		e.preventDefault();
		if (visible_items.length < 1) {
			return;
		}
		if (selected + 1 === visible_items.length) {
			return;
		}
		selected += 1;
	};
	const on_arrow_up = (e: KeyboardEvent) => {
		if (!open) return;
		e.preventDefault();
		if (visible_items.length < 1) {
			return;
		}
		if (selected === 0) {
			return;
		}
		selected -= 1;
	};

	const on_enter = (_e: KeyboardEvent) => {
		if (!open || selected === null) {
			return;
		}
		execute_action();
		input = '';
	};

	onMount(async () => {
		tinykeys(window, {
			'$mod+k': toggle_open,
			Escape: close_cp,
			Tab: autocomplete_on_tab,
			// Without it Shift+Tab walked out of the dialog to the page behind.
			'Shift+Tab': (e: KeyboardEvent) => {
				if (open) e.preventDefault();
			},
			ArrowDown: on_arrow_down,
			ArrowUp: on_arrow_up,
			Enter: on_enter
		});
		title_ms = new MiniSearch<any>({
			fields: ['title'],
			storeFields: ['id']
		});
		title_ms.addAll(actions);
		command_ms = new MiniSearch<any>({
			fields: ['command'],
			storeFields: ['id']
		});
		command_ms.addAll(actions);
	});
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex h-dvh w-full bg-black/50"
		onclick={close_on_outside}
		role="presentation"
		transition:fade|global={{ duration: 60 }}
	>
		<!-- A named dialog: the backdrop used to be one role="button" named Close around the
		     whole panel, so a screen reader heard a button with a text field inside it. -->
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Command palette"
			class="border-border bg-popover text-popover-foreground m-auto flex max-h-[60vh] w-[min(36rem,calc(100%-2rem))] flex-col overflow-hidden rounded-xl border shadow-xl"
		>
			<div class="border-border grid grid-cols-1 grid-rows-1 border-b">
				<p class="text-muted-foreground col-start-1 row-start-1 w-full p-4 outline-hidden">
					{bg_text}
				</p>
				<input
					type="text"
					class="text-foreground col-start-1 row-start-1 w-full bg-transparent p-4 outline-hidden"
					bind:value={input}
					oninput={() => search(input)}
					aria-label="Search commands"
					use:grab_focus
				/>
			</div>
			<div class="flex flex-col p-2 gap-2 overflow-scroll">
				{#each visible_items as vi, i}
					<div
						transition:fade={{ duration: 60 }}
						class="rounded-md p-2 transition"
						class:bg-accent={selected === i}
						class:text-accent-foreground={selected === i}
						class:bg-muted={selected !== i}
						onmouseenter={() => (selected = i)}
						onmousedown={execute_action}
						tabindex="-2"
						role="button"
					>
						<!-- The /command syntax used to show here, in monospace, with nothing to
						     say how to use it. Typing the words of a title finds it anyway. -->
						<h3 class="text-lg">{vi.title}</h3>
						<p class="text-sm">{vi.description}</p>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}
