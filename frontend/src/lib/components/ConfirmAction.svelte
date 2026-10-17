<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	// A button that asks before it acts. For the ways out of a live game -- cancel,
	// end, leave -- each of which can't be undone and is easy to hit by accident on a
	// projector remote or a phone, and for deleting a quiz.
	//
	// `permanent` makes the confirm button solid red (V1 menus review, 17 Oct): a deleted
	// quiz is gone, while leaving a lobby is not, and the two looked the same. Without
	// `children` there is no trigger, and the caller opens it with `bind:open` (a menu item
	// that has to close its menu first).
	import type { Snippet } from 'svelte';
	import { Button, buttonVariants, type ButtonVariant } from '$lib/components/ui/button/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';

	interface Props {
		title: string;
		body: string;
		confirmLabel: string;
		cancelLabel: string;
		onconfirm: () => void;
		variant?: ButtonVariant;
		class?: string;
		/** Solid red confirm button, for what cannot be undone. */
		permanent?: boolean;
		open?: boolean;
		/** Where focus goes on close when there is no trigger: the menu's button. */
		returnFocus?: HTMLElement | null;
		/** The trigger's content: an icon and a label. Leave it out to open by `open`. */
		children?: Snippet;
	}

	let {
		title,
		body,
		confirmLabel,
		cancelLabel,
		onconfirm,
		variant = 'ghost',
		class: className = '',
		permanent = false,
		open = $bindable(false),
		returnFocus = null,
		children
	}: Props = $props();
</script>

<AlertDialog.Root bind:open>
	{#if children}
		<AlertDialog.Trigger class={buttonVariants({ variant, size: 'sm', class: className })}>
			{@render children()}
		</AlertDialog.Trigger>
	{/if}
	<AlertDialog.Content
		class="max-w-md"
		onCloseAutoFocus={(e) => {
			if (!children && returnFocus) {
				e.preventDefault();
				returnFocus.focus();
			}
		}}
	>
		<AlertDialog.Header>
			<AlertDialog.Title>{title}</AlertDialog.Title>
			<AlertDialog.Description>{body}</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{cancelLabel}</AlertDialog.Cancel>
			<Button
				variant={permanent ? 'danger' : 'destructive'}
				onclick={() => {
					open = false;
					onconfirm();
				}}
			>
				{confirmLabel}
			</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
