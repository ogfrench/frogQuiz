<!-- SPDX-FileCopyrightText: 2026 frogQuiz contributors
     SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	let { message }: { message: string } = $props();
	let retrying = $state(false);
	async function retry() {
		retrying = true;
		try {
			await invalidateAll();
		} finally {
			retrying = false;
		}
	}
</script>

<div
	role="status"
	class="border-border bg-muted/50 my-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-left text-sm"
>
	<p class="min-w-0 flex-1">{message}</p>
	<Button variant="outline" disabled={retrying} onclick={retry}
		>{retrying ? 'Retrying…' : 'Retry'}</Button
	>
</div>
