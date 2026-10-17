<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts" generics="V extends string">
	// A choice between a few options, all in view, as real radio buttons in a fieldset
	// (V1 screens review, 17 Oct). It replaced buttons that showed the current state as
	// their label ("Unlisted"), so pressing one read as confirming it, and one press made a
	// quiz public with nothing saying it was a switch.
	import type { Component } from 'svelte';

	interface Option {
		value: V;
		label: string;
		icon?: Component;
	}

	interface Props {
		legend: string;
		/** Keep the legend for screen readers only, where the options explain themselves. */
		legendHidden?: boolean;
		name: string;
		options: Option[];
		value: V;
		onchange: (value: V) => void;
		describedby?: string;
		class?: string;
	}

	let {
		legend,
		legendHidden = false,
		name,
		options,
		value,
		onchange,
		describedby,
		class: className = ''
	}: Props = $props();
</script>

<fieldset class="min-w-0 {className}" aria-describedby={describedby}>
	<legend class={legendHidden ? 'sr-only' : 'text-muted-foreground mb-2 text-sm font-medium'}>
		{legend}
	</legend>
	<div class="bg-muted inline-flex max-w-full flex-wrap gap-1 rounded-lg p-1">
		{#each options as option (option.value)}
			<label
				class="text-muted-foreground hover:text-foreground has-checked:bg-background has-checked:text-foreground has-focus-visible:ring-ring/50 any-pointer-coarse:min-h-11 flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors select-none has-checked:shadow-sm has-focus-visible:ring-3 [&_svg]:size-4 [&_svg]:shrink-0"
			>
				<input
					type="radio"
					class="sr-only"
					{name}
					value={option.value}
					checked={value === option.value}
					onchange={() => onchange(option.value)}
				/>
				{#if option.icon}
					<option.icon aria-hidden="true" />
				{/if}
				{option.label}
			</label>
		{/each}
	</div>
</fieldset>
