<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<!-- Was a hand-drawn SVG filled black and blue-100: invisible on the dark ground and on
     the primary button, and announced as nothing. Now Lucide's LoaderCircle in
     currentColor, so it follows whatever text colour it sits in. `class` overrides the
     default muted colour (or the size) where the ground is not the page. -->
<script lang="ts">
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { getLocalization } from '$lib/i18n';
	import { cn } from '$lib/utils';

	interface Props {
		my_20?: boolean;
		class?: string;
	}

	let { my_20 = true, class: className = '' }: Props = $props();

	const { t } = getLocalization();
</script>

<span
	role="status"
	class={cn('text-muted-foreground mx-auto flex w-fit', my_20 && 'my-20', className)}
>
	<LoaderCircle class="size-8 animate-spin" aria-hidden="true" />
	<span class="sr-only">{$t('words.loading')}</span>
</span>
