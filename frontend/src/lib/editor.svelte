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
	import { isQuestionComplete } from '$lib/editor/question_complete';
	import { Button } from '$lib/components/ui/button';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Save from '@lucide/svelte/icons/save';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

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

	// Same rule the rail marks each question against, counted for the header.
	const incomplete_count = $derived(
		(data.questions ?? []).filter((q) => !isQuestionComplete(q)).length
	);
	let edit_id: string = $state();
	// The prompt used to be armed from the moment the editor mounted, so opening a quiz and
	// going straight back asked whether you wanted to discard changes you had not made. It
	// now arms on the first real edit. A form-level input/change listener is deliberate over
	// watching `data`: it cannot miss an edit made through a form control, and missing one
	// would lose someone's work.
	let confirm_to_leave = $state(false);

	const getEditID = async () => {
		let res: Response;
		if (quiz_id === null) {
			res = await fetch(`/api/v1/editor/start?edit=false`, {
				method: 'POST'
			});
		} else {
			res = await fetch(`/api/v1/editor/start?edit=true&quiz_id=${quiz_id}`, {
				method: 'POST'
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
		const res = await fetch(`/api/v1/editor/finish?edit_id=${edit_id}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(data)
		});
		if (res.ok) {
			confirm_to_leave = false;
			console.log(confirm_to_leave);
			window.location.href = '/dashboard';
		} else {
			alert('Error');
		}
	};
</script>

<svelte:window onbeforeunload={confirmUnload} />
{#await getEditID()}
	<Spinner />
{:then _}
	<form
		onsubmit={saveQuiz}
		oninput={() => (confirm_to_leave = true)}
		onchange={() => (confirm_to_leave = true)}
	>
		<!-- w-screen is 100vw, which includes the scrollbar, and put a horizontal
		     scrollbar on every editor session. w-full is the width we actually want. -->
		<div class="flex h-screen w-full">
			<Sidebar bind:data bind:selected_question />
			<div class="flex min-w-0 flex-1 flex-col">
				<header
					class="border-border bg-background flex h-14 shrink-0 items-center gap-3 border-b px-4"
				>
					<Button
						href="/dashboard"
						variant="ghost"
						size="icon"
						aria-label={$t('words.back')}
					>
						<ArrowLeft />
					</Button>
					<p class="min-w-0 truncate font-medium">{@html data.title}</p>
					{#if schemaInvalid}
						<!-- The old header showed a raw yup message, which named a field path rather
						     than telling the author what to go and fix. The count points at the rail,
						     where each unfinished question is already flagged. -->
						<p
							class="text-destructive ml-auto flex min-w-0 items-center gap-2 text-sm font-medium"
						>
							<TriangleAlert class="size-4 shrink-0" />
							<span class="truncate">
								{incomplete_count > 0
									? $t('editor.needs_attention', { count: incomplete_count })
									: yupErrorMessage}
							</span>
						</p>
					{/if}
					<Button
						type="submit"
						class={schemaInvalid ? 'ml-3' : 'ml-auto'}
						disabled={schemaInvalid}
					>
						<Save />
						{$t('words.save')}
					</Button>
				</header>
				<div class="min-h-0 flex-1 overflow-y-auto p-6">
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
