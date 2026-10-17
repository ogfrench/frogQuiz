<!-- SPDX-FileCopyrightText: 2026 frogQuiz contributors
     SPDX-License-Identifier: MPL-2.0 -->
<!-- What Copy link did, said once for the whole app. The live region is always in the
     page, so a screen reader hears the text when it lands. aria-live rather than
     role="status": an empty status on every page shadowed each page's own one. -->
<script lang="ts">
	import { share_notice } from '$lib/share_link.svelte';
</script>

<div
	aria-live="polite"
	aria-atomic="true"
	class="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-50 flex justify-center px-4"
>
	{#if share_notice.text}
		<!-- The same card as the lobby's removal toast, not an inverted black block (17 Oct).
		     Not a pill: when copying fails it holds the link to copy by hand, which wraps. -->
		<p
			class="border-border bg-card text-foreground pointer-events-auto max-w-md rounded-lg border px-4 py-2.5 text-sm break-all shadow-md select-text"
		>
			{share_notice.text}
		</p>
	{/if}
</div>
