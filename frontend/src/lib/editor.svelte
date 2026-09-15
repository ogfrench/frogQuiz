<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { dataSchema } from '$lib/yupSchemas';
	import type { EditorData } from './quiz_types';
	import Sidebar from '$lib/editor/sidebar.svelte';
	import SettingsCard from '$lib/editor/settings-card.svelte';
	import QuizCard from '$lib/editor/card.svelte';
	import Spinner from './Spinner.svelte';
	import { getLocalization } from '$lib/i18n';
	import { getAnonSecret, setAnonSecret } from '$lib/anon_quiz';

	const { t } = getLocalization();

	let schemaInvalid = $state(false);
	let yupErrorMessage = $state('');

	interface Props {
		data: EditorData;
		quiz_id: string | null;
	}

	let { data = $bindable(), quiz_id }: Props = $props();
	let selected_question = $state(-1);

	const validateInput = async (data: EditorData) => {
		try {
			await dataSchema.validate(data, { abortEarly: false });
			schemaInvalid = false;
			yupErrorMessage = '';
		} catch (err) {
			schemaInvalid = true;
			yupErrorMessage = err.errors ? err.errors[0] : '';
		}
	};
	$effect(() => {
		validateInput(data);
	});
	let edit_id: string = $state();
	let confirm_to_leave = true;

	const getEditID = async () => {
		const anon_secret = quiz_id === null ? null : getAnonSecret(quiz_id);
		const headers: Record<string, string> = anon_secret ? { 'X-Anon-Secret': anon_secret } : {};
		let res: Response;
		if (quiz_id === null) {
			res = await fetch(`/api/v1/editor/start?edit=false`, {
				method: 'POST',
				headers
			});
		} else {
			res = await fetch(`/api/v1/editor/start?edit=true&quiz_id=${quiz_id}`, {
				method: 'POST',
				headers
			});
		}
		if (res.status === 200) {
			const json = await res.json();
			edit_id = json.token;
		} else {
			alert('Error!');
		}
	};

	const confirmUnload = (event: BeforeUnloadEvent) => {
		if (!confirm_to_leave) {
			return;
		}
		event.preventDefault();
		event.returnValue = 'Are you sure you want to leave?';
		localStorage.setItem('edit_game', JSON.stringify(data));
		return 'unload';
	};
	const saveQuiz = async (e: Event) => {
		e.preventDefault();
		if (schemaInvalid) {
			return;
		}
		const anon_secret = quiz_id === null ? null : getAnonSecret(quiz_id);
		const res = await fetch(`/api/v1/editor/finish?edit_id=${edit_id}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(anon_secret ? { 'X-Anon-Secret': anon_secret } : {})
			},
			body: JSON.stringify(data)
		});
		if (res.ok) {
			confirm_to_leave = false;
			// A quiz created without an account has no dashboard entry to land
			// on -- and the server only ever hands back a fresh secret for
			// exactly that case, once, right here.
			const new_anon_secret = res.headers.get('X-Anon-Secret');
			if (new_anon_secret) {
				const saved = await res.json();
				setAnonSecret(saved.id, new_anon_secret);
				window.location.href = `/view/${saved.id}`;
			} else {
				window.location.href = '/dashboard';
			}
		} else {
			alert('Error');
		}
	};
</script>

<svelte:window onbeforeunload={confirmUnload} />
{#await getEditID()}
	<Spinner />
{:then _}
	<form onsubmit={saveQuiz}>
		<div class="grid grid-cols-6 h-screen w-screen">
			<div>
				<Sidebar bind:data bind:selected_question />
			</div>
			<div class="col-span-5 flex flex-col">
				<div
					class="h-10 w-full bg-white mb-10 flex align-middle justify-center rounded-br-lg"
				>
					{#if schemaInvalid}
						<p class="text-center w-full text-red-600 h-full mt-0.5 font-semibold">
							{yupErrorMessage}
						</p>
					{:else}
						<p class="text-center w-full text-black h-full align-bottom mt-0.5">
							{@html data.title}
						</p>
					{/if}
					<button
						class="pr-2 align-middle bg-[#B07156] pl-2 ml-auto whitespace-nowrap disabled:opacity-60 rounded-br-lg"
						disabled={schemaInvalid}
					>
						<span>{$t('words.save')}</span>
						<svg
							class="w-6 h-6 inline-block"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
							/>
						</svg>
					</button>
				</div>
				<div class="w-full h-full">
					{#if selected_question === -1}
						<SettingsCard bind:data bind:edit_id />
					{:else}
						<QuizCard bind:data bind:selected_question bind:edit_id />
					{/if}
				</div>
			</div>
		</div>
	</form>
{/await}
