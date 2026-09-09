<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { navbarVisible } from '$lib/stores.svelte.ts';
	import { page } from '$app/state';
	import { getLocalization } from '$lib/i18n';
	import ErrorPage from '$lib/components/ErrorPage.svelte';

	navbarVisible.visible = true;
	let status = page.status;
	const { t } = getLocalization();
</script>

<svelte:head>
	<title>{$t('words.error')} - {status}</title>
</svelte:head>

<ErrorPage
	{status}
	description={status === 404
		? $t('error_page.quiz_404_text')
		: $t('error_page.unknown_error_text')}
/>
