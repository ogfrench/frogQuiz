<!-- SPDX-FileCopyrightText: 2026 frogQuiz contributors
     SPDX-License-Identifier: MPL-2.0 -->
<!-- What Copy link did, said once for the whole app. The live region is always in the
     page, so a screen reader hears the text when it lands. -->
<script lang="ts">
	import { share_notice } from '$lib/share_link.svelte';
</script>

<div
	role="status"
	class="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-50 flex justify-center px-4"
>
	{#if share_notice.text}
		<p
			class="bg-foreground text-background pointer-events-auto max-w-md rounded-lg px-4 py-2.5 text-sm break-all shadow-lg select-text"
		>
			{share_notice.text}
		</p>
	{/if}
</div>
