<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { run } from 'svelte/legacy';

	// ckeditor5 touches `document` while its modules initialise, which crashes any
	// server-side render. It is only ever used in onMount, so load it there.
	import 'ckeditor5/ckeditor5.css';

	const triggerChange = () => {
		text = editor.getData();
	};

	import { onMount } from 'svelte';
	interface Props {
		// import Autoformat from "@ckeditor/ckeditor5-autoformat/src/autoformat"
		text?: string;
	}

	let { text = $bindable('') }: Props = $props();

	let html_el = $state();

	run(() => {
		text = text.replace('<p>', '').replace('</p>', '');
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
			// plugins: [Strikethrough],
			config: {
				enterMode: BalloonEditor.ENTER_DIV,
				shiftEnterMode: BalloonEditor.ENTER_BR
			},
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
	class="border-input bg-background focus-within:ring-ring min-w-[5rem] resize-none rounded-lg border px-3 py-2 text-center focus-within:ring-2 focus-within:outline-none"
></div>

<style>
	:global(.ck-powered-by) {
		display: none;
	}

	/* ckeditor5.css sets its own text colour, which is a near-black constant. It does
	   not know about the theme, so in dark mode the question title rendered black on
	   a dark ground and was all but invisible. Hand it the tokens instead of letting
	   it pick. The balloon toolbar needs the same, or it arrives as a white slab. */
	:global(.ck.ck-content),
	:global(.ck.ck-editor__editable) {
		color: inherit;
		background: transparent;
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
