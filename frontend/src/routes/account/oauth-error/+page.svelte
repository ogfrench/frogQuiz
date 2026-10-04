<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	let { data } = $props();
	const { error } = data;
</script>

<div>
	<div class="flex justify-center w-full">
		<h1 class="text-6xl">Error authenticating</h1>
	</div>

	<div class="flex justify-center w-full pt-10">
		<p>
			{#if error === 'email'}
				GitHub didn't send back an email address. Is yours verified on GitHub?
			{:else}
				Sign-in failed. Does your account have an email address, and is it verified?
			{/if}
		</p>
	</div>
	<div class="flex justify-center w-full pt-10">
		<a
			href="/account/login"
			class="px-4 py-2 leading-5 text-black dark:text-white transition-colors duration-200 transform bg-gray-50 dark:bg-gray-700 rounded-sm text-center hover:bg-gray-600 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
		>
			Back to login
		</a>
	</div>
	<div class="flex justify-center w-full pt-10">
		<p>
			If the error persists, please open an <a
				href="https://github.com/ogfrench/frogQuiz/issues/new"
				class="underline transition hover:text-blue-300">issue on GitHub</a
			>.
		</p>
	</div>
</div>
