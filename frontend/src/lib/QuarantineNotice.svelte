<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	// The sign-in email is often held by Capgemini's mail filter. People read past a line of
	// grey text about that, and then ask for another email that gets held too, so this is a
	// boxed notice with one way out.
	import { getLocalization } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button/index.js';
	import MailWarning from '@lucide/svelte/icons/mail-warning';
	import ExternalLink from '@lucide/svelte/icons/external-link';

	const { t } = getLocalization();
	const QUARANTINE_URL = 'https://spam-quarantine.capgemini.com';
</script>

<aside
	class="bg-muted/40 border-border border-l-primary grid gap-3 rounded-lg border border-l-4 p-4 text-left"
	aria-labelledby="quarantine-title"
>
	<div class="flex items-center gap-2">
		<MailWarning class="text-primary size-5 shrink-0" aria-hidden="true" />
		<p id="quarantine-title" class="text-base leading-tight font-semibold">
			{$t('quarantine.title')}
		</p>
	</div>
	<p class="text-sm leading-relaxed">{$t('quarantine.text')}</p>
	<Button
		href={QUARANTINE_URL}
		target="_blank"
		rel="noopener"
		class="w-full sm:w-auto sm:justify-self-start"
	>
		{$t('quarantine.open')}
		<ExternalLink class="size-4" aria-hidden="true" />
	</Button>
	<p class="text-muted-foreground text-xs leading-relaxed">{$t('quarantine.foot')}</p>
</aside>
