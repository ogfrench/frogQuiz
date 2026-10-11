<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { run } from 'svelte/legacy';

	// ckeditor5 touches `document` while its modules initialize, which crashes any
	// server-side render. It is only ever used in onMount, so load it there.
	import 'ckeditor5/ckeditor5.css';
	import { sanitizeTitleHtml } from '$lib/sanitize';

	const triggerChange = () => {
		text = sanitizeTitleHtml(editor.getData());
	};

	import { onMount } from 'svelte';
	interface Props {
		// import Autoformat from "@ckeditor/ckeditor5-autoformat/src/autoformat"
		text?: string;
		/**
		 * Accessible name for the editable. CKEditor labels every instance "Rich Text
		 * Editor", so with the quiz title and every question's text on one page they were
		 * indistinguishable to a screen reader -- and to anything else driving the page.
		 */
		label?: string;
	}

	let { text = $bindable(''), label = '' }: Props = $props();

	let html_el = $state<HTMLElement>();

	// Sanitizes on every assignment, not just our own triggerChange, so a value
	// coming in from the parent (e.g. legacy unsanitized data loaded from the
	// server) is cleaned up too.
	run(() => {
		text = sanitizeTitleHtml(text);
	});
	let editor;
	onMount(async () => {
		const {
			BalloonEditor,
			Essentials,
			Autoformat,
			Bold,
			Italic,
			Paragraph,
			TextTransformation,
			Superscript,
			Subscript,
			Strikethrough
		} = await import('ckeditor5');

		class Editor extends BalloonEditor {
			static builtinPlugins = [
				Essentials,
				Autoformat,
				Bold,
				Italic,
				Paragraph,
				TextTransformation,
				Strikethrough,
				Subscript,
				Superscript
			];

			static defaultConfig = {
				language: 'en'
			};
		}
		// BalloonEditor.builtinPlugins = [Strikethrough]
		Editor.create(html_el, {
			licenseKey: 'GPL',
			// The accessible name, given at creation. It used to be set on the element
			// afterwards, and the editing view put its own "Rich Text Editor. Editing area:
			// main" back on the first edit, so after typing a word the title and every
			// question were nameless again to a screen reader (found 11 Oct).
			label: label || undefined,
			// plugins: [Strikethrough],
			// A `config: { enterMode, shiftEnterMode }` block sat here: CKEditor 4 options.
			// CKEditor 5 has neither constant, so both were undefined and it was ignored.
			toolbar: [
				'bold',
				'italic',
				'strikethrough',
				'superscript',
				'subscript',
				'|',
				'undo',
				'redo'
			]
		})
			.then((newEditor) => {
				editor = newEditor;
				editor.setData(text);
				editor.model.document.on('change:data', () => {
					triggerChange();
				});
			})
			.catch((error) => {
				console.error('There was a problem initializing the editor.', error);
			});
	});
</script>

<!-- This was two nested bordered boxes, which read as a box inside a box wherever it was
     used, and it carried its own dark-mode greys. One bordered field, on tokens. -->
<div
	bind:this={html_el}
	contenteditable="true"
	class="border-input bg-background focus-within:ring-ring min-w-[5rem] resize-none rounded-md border px-3 py-2 text-center focus-within:ring-2 focus-within:outline-none"
></div>

<style>
	:global(.ck-powered-by) {
		display: none;
	}

	/* ckeditor5.css sets its own text color, which is a near-black constant. It does
	   not know about the theme, so in dark mode the question title rendered black on
	   a dark ground and was all but invisible. Hand it the tokens instead of letting
	   it pick. The balloon toolbar needs the same, or it arrives as a white slab. */
	/* ckeditor takes the element over on init and applies its own editable styling, so
	   the border and padding set in the markup stop reading -- on an empty new quiz the
	   title showed as a label over blank space, with "A title is required" above it and
	   nowhere visible to type. Give the editable the same affordance as every other
	   field on the page. */
	/* ckeditor's own selectors plus `_inline`, so these outrank its square corners and its
	   thin focus border whatever order the stylesheets load in. They lost, and the title
	   and every question were square with a 1px focus line, next to fields with curved
	   corners and a 2px ring (François asked why, 11 Oct). One shape, one border, one ring
	   for every text field, whatever draws it. */
	:global(.ck.ck-content),
	:global(.ck.ck-editor__editable.ck-editor__editable_inline:not(.ck-editor__nested-editable)) {
		color: inherit;
		min-height: 2.75rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--input);
		border-radius: var(--radius-md);
		background: var(--background);

		/* ckeditor paints a focused editable with its own blue (--ck-color-focus-border),
		   and --ck-focus-ring is resolved at :root, so both need setting here. Same token
		   as the ring below. Its rounded-corners rule reads --ck-border-radius. */
		--ck-color-focus-border: var(--ring);
		--ck-focus-ring: 1px solid var(--input);
		--ck-border-radius: var(--radius-md);
		--ck-inner-shadow: 0 0 0 transparent;
	}

	:global(
		.ck.ck-editor__editable.ck-editor__editable_inline.ck-focused:not(
				.ck-editor__nested-editable
			)
	) {
		outline: none;
		border: 1px solid var(--input);
		box-shadow: 0 0 0 2px var(--ring);
	}

	:global(.ck.ck-balloon-panel) {
		--ck-color-base-background: var(--popover);
		--ck-color-base-foreground: var(--popover);
		--ck-color-base-text: var(--popover-foreground);
		--ck-color-base-border: var(--border);
		--ck-color-button-default-hover-background: var(--muted);
		--ck-color-button-on-background: var(--muted);
		--ck-color-button-on-color: var(--foreground);
		--ck-color-text: var(--popover-foreground);
		border-color: var(--border);
	}

	:global(.ck.ck-toolbar) {
		background: var(--popover);
		border-color: var(--border);
	}

	:global(.ck.ck-button) {
		color: var(--popover-foreground);
	}
</style>
