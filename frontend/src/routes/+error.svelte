<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { page } from '$app/state';
	import { getLocalization } from '$lib/i18n';
	import ErrorPage from '$lib/components/ErrorPage.svelte';

	const status = $derived(page.status);
	const { t } = getLocalization();
</script>

<svelte:head>
	<title>{$t('words.error')} - {status}</title>
</svelte:head>

<ErrorPage
	{status}
	title={status === 503 ? 'Temporarily unavailable' : undefined}
	description={status === 503 ? 'We couldn’t reach the service. Please try again shortly.' : status === 404 ? $t('error_page.404_text') : $t('error_page.unknown_error_text')}
/>
