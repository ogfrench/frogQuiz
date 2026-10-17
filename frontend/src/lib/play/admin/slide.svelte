<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { isDrawnSlide, type Question } from '$lib/quiz_types';
	import { onMount } from 'svelte';
	import Pikaso from 'pikaso';
	import MediaComponent from '$lib/editor/MediaComponent.svelte';
	import { sanitizeTitleHtml } from '$lib/sanitize';

	interface Props {
		question: Question;
		/** Inside a card (the quiz page), not the projector: no full-screen stage. */
		compact?: boolean;
	}

	let { question, compact = false }: Props = $props();

	let canvas_el: HTMLDivElement | undefined = $state();
	let canvas: Pikaso;
	let img_src = $state('');
	// A plain slide (#93) has no drawing: its title, text and image are shown as a question's.
	const drawn = $derived(isDrawnSlide(question));

	onMount(() => {
		if (!drawn) return;
		canvas = new Pikaso({
			container: canvas_el,
			snapToGrid: {},
			selection: {
				interactive: false
			}
		});
		if (typeof question.answers === 'string') {
			const data = JSON.parse(question.answers);
			canvas.import.json(data);
			img_src = canvas.export.toImage();
		}
	});
</script>

<!-- fq-stage, like every other host surface. Without it this sat flush against the
     top of the projector with the bottom half empty. -->
{#if drawn}
	<div class="fq-stage">
		<div class="hidden">
			<div bind:this={canvas_el} class="w-full h-full block"></div>
		</div>
		<div class="flex w-full justify-center">
			<!-- h-full against fq-stage (which has no fixed height) collapsed to nothing.
			     Cap the image instead and let the stage do the centering. -->
			<img src={img_src} alt="Slide image" class="max-h-[70dvh] max-w-full object-contain" />
		</div>
	</div>
{:else}
	<!-- Side by side on a projector, stacked on a narrow screen; text alone is centered. -->
	<div class={compact ? 'flex flex-col items-center' : 'fq-stage'}>
		<div
			class="grid w-full max-w-6xl items-center gap-[var(--fq-space-section)] {question.image
				? 'lg:grid-cols-2'
				: 'max-w-4xl'}"
		>
			{#if question.image}
				<div class="flex justify-center">
					<MediaComponent
						src={question.image}
						muted={false}
						css_classes="max-h-[60dvh] w-auto rounded-2xl object-cover"
					/>
				</div>
			{/if}
			<div
				class="flex flex-col gap-[var(--fq-space-group)] {question.image
					? ''
					: 'items-center text-center'}"
			>
				<h1
					class="{compact
						? 'text-xl'
						: 'fq-display'} font-bold text-balance wrap-anywhere"
				>
					{@html sanitizeTitleHtml(question.question)}
				</h1>
				{#if question.body}
					<p
						class="fq-answer text-muted-foreground max-w-[45ch] whitespace-pre-line wrap-anywhere"
					>
						{question.body}
					</p>
				{/if}
			</div>
		</div>
	</div>
{/if}
