<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { alertModal } from '$lib/stores';
	import { navbarVisible } from '$lib/stores.svelte';
	import { slide } from 'svelte/transition';
	import Footer from '$lib/footer.svelte';
	import VerifiedBadge from './verified_badge.svelte';
	import StartWindow from './start_window.svelte';
	import SelectMethod from './select_method.svelte';
	import PasswordComponent from './password_component.svelte';
	import BackupComponent from './backup_component.svelte';
	import TotpComponent from './totp_component.svelte';
	import * as Card from '$lib/components/ui/card/index.js';

	navbarVisible.visible = true;

	let { data } = $props();
	let { verified } = data;

	let session_data = $state({});
	let step = $state(0);
	let selected_method = $state(null);
	let done = $state(false);

	const redirect_back = (done_var: boolean) => {
		if (done_var) {
			setTimeout(() => {
				window.location.reload();
			}, 100);
		}
	};
	let alertModalOpen = false;
	$effect(() => {
		redirect_back(done);
	});

	alertModal.subscribe((data) => {
		if (!alertModalOpen && data.open) {
			alertModalOpen = true;
		}
		if (alertModalOpen && !data.open) {
			window.location.reload();
		}
	});

	const check_auto = (stp: number) => {
		if (stp === 1) {
			{
				for (let i = 0; i < session_data.step_1.length; i++) {
					if (session_data.step_1[i] === 'PASSKEY') {
						session_data.step_1.splice(i, 1);
					}
				}
				session_data.step_1 = session_data.step_1;
			}
			if (session_data.step_1.length === 1) {
				selected_method = session_data.step_1[0];
			}
		}
		if (stp === 2) {
			{
				for (let i = 0; i < session_data.step_2.length; i++) {
					if (session_data.step_2[i] === 'PASSKEY') {
						session_data.step_2.splice(i, 1);
					}
				}
				session_data.step_2 = session_data.step_2;
			}
			if (session_data.step_2.length === 1) {
				selected_method = session_data.step_2[0];
			}
		}
	};
	$effect(() => check_auto(step));
</script>

<svelte:head>
	<title>frogQuiz - Login</title>
</svelte:head>
<div class="flex min-h-screen items-center justify-center px-4">
	{#if verified}
		<VerifiedBadge />
	{/if}

	<Card.Root class="w-full max-w-sm overflow-hidden pt-6 pb-0 shadow-xl">
		{#if step === 0}
			<!--			<p>StartWindow</p>-->
			<div class="flex flex-col gap-(--card-spacing)" transition:slide|global>
				<StartWindow bind:session_data bind:step />
			</div>
		{:else if selected_method === null}
			<!--			<p>SelectWindow</p>-->
			<div class="flex flex-col gap-(--card-spacing)" transition:slide|global>
				<SelectMethod {session_data} {step} bind:selected_method />
			</div>
		{:else if selected_method === 'PASSWORD'}
			<!--			<p>PasswordWindow</p>-->
			<div class="flex flex-col gap-(--card-spacing)" transition:slide|global>
				<PasswordComponent {session_data} bind:done bind:step bind:selected_method />
			</div>
		{:else if selected_method === 'BACKUP'}
			<!--			<p>BackupWindow</p>-->
			<div class="flex flex-col gap-(--card-spacing)" transition:slide|global>
				<BackupComponent {session_data} bind:done bind:step bind:selected_method />
			</div>
		{:else if selected_method === 'TOTP'}
			<!--			<p>TotpWindow</p>-->
			<div class="flex flex-col gap-(--card-spacing)" transition:slide|global>
				<TotpComponent {session_data} bind:done bind:step bind:selected_method />
			</div>
		{/if}
	</Card.Root>
</div>
<Footer />
