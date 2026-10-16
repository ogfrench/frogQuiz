<!-- SPDX-FileCopyrightText: 2026 frogQuiz contributors
     SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { healthMessage } from '$lib/service_health';
	let { configUnavailable = false }: { configUnavailable?: boolean } = $props();
	let problem = $state<string | null>(null);
	let checking = $state(false);
	let stopped = false;
	let controller: AbortController | undefined;
	const message = $derived(
		problem ??
			(configUnavailable
				? 'Quiz creation is temporarily unavailable. Please try again shortly.'
				: null)
	);
	async function check(retryConfig = false) {
		if (checking) return;
		checking = true;
		controller = new AbortController();
		const timeout = setTimeout(() => controller?.abort(), 15000);
		try {
			const response = await fetch('/api/v1/health', {
				signal: controller.signal,
				cache: 'no-store'
			});
			const body = await response.json();
			if (!stopped) {
				problem = healthMessage(body, response.ok);
				if (retryConfig && configUnavailable) await invalidate('app:config');
			}
		} catch {
			if (!stopped)
				problem = navigator.onLine
					? healthMessage(null, false)
					: 'You’re offline. Keep this tab open and reconnect before saving or hosting.';
		} finally {
			clearTimeout(timeout);
			checking = false;
		}
	}
	onMount(() => {
		void check();
		const timer = setInterval(() => {
			if (!document.hidden) void check(true);
		}, 60000);
		// Both also re-read the guest setting when it was unavailable, so the banner and
		// the copy that depends on it recover without a click once the API is back.
		const online = () => {
			void check(true);
		};
		window.addEventListener('online', online);
		return () => {
			stopped = true;
			clearInterval(timer);
			controller?.abort();
			window.removeEventListener('online', online);
		};
	});
</script>

{#if message}
	<div
		role="status"
		aria-live="polite"
		class="border-border bg-muted text-foreground relative z-40 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-5 py-3 text-sm"
		data-testid="service-banner"
	>
		<p class="min-w-0 flex-1">{message}</p>
		<Button variant="outline" size="sm" disabled={checking} onclick={() => check(true)}
			>{checking ? 'Checking…' : 'Check connection'}</Button
		>
	</div>
{/if}
