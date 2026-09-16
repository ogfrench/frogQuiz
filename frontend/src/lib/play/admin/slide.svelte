<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import type { Question } from '$lib/quiz_types';
	import { onMount } from 'svelte';
	import Pikaso from 'pikaso';

	interface Props {
		question: Question;
	}

	let { question }: Props = $props();

	let canvas_el: HTMLDivElement | undefined = $state();
	let canvas: Pikaso;
	let img_src = $state('');

	onMount(() => {
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
<div class="fq-stage">
	<div class="hidden">
		<div bind:this={canvas_el} class="w-full h-full block"></div>
	</div>
	<div class="flex w-full justify-center">
		<!-- h-full against fq-stage (which has no fixed height) collapsed to nothing.
		     Cap the image instead and let the stage do the centring. -->
		<img src={img_src} alt="Slide image" class="max-h-[70dvh] max-w-full object-contain" />
	</div>
</div>
