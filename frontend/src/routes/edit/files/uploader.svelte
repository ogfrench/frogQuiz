<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import Spinner from '$lib/Spinner.svelte';
	import type { EditorData } from '$lib/quiz_types';

	let uppyOpen = $state(false);
	let selected_question = $state(undefined);
	// The uploader writes the picked image to data.cover_image; nothing else of a quiz is here.
	let data = $state({ cover_image: undefined } as EditorData);

	$effect(() => {
		if (data.cover_image) {
			window.location.reload();
		}
	});
</script>

{#await import('$lib/editor/uploader.svelte')}
	<Spinner my_20={false} />
{:then c}
	<c.default
		bind:modalOpen={uppyOpen}
		bind:data
		bind:selected_question
		video_upload={true}
		library_enabled={false}
	/>
{/await}
