<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)

SPDX-License-Identifier: MPL-2.0
-->

<!--<script lang='ts'>
	import { onMount } from 'svelte';
	import '$lib/hljs.css';

	onMount(async () => {
		const { default: hljs } = await import('highlight.js/lib/common');
		hljs.highlightAll();
	});
</script>-->

<svelte:head>
	<title>frogQuiz/docs - Terms of Service</title>
	<meta name="description" content="The terms of service for frogQuiz." />
</svelte:head>

<article
	class="prose prose-sm sm:prose lg:prose-lg xl:prose-xl mx-auto mt-10 prose-slate px-4 dark:prose-invert"
>
	<h1>Terms</h1>

	<p>
		frogQuiz is an internal tool run by François and Gonçalo. It is free, open source, and
		provided as-is with no uptime guarantee — it can break, lose data, or go away. Keep a copy
		elsewhere of anything you would mind losing.
	</p>

	<h2>Your side</h2>
	<p>
		Do not put anything illegal, harassing or pornographic in it, and do not put confidential
		information or other people's personal details in a quiz — everyone playing can see it, and
		a public quiz is visible to anyone.
	</p>

	<h2>Our side</h2>
	<p>
		We will remove content that breaks the above, and we may look at stored data when we need to
		fix something or handle a report. We will not publish your content or your personal data,
		and we will not sell or share it, unless the law makes us. See
		<a href="/docs/privacy-policy">privacy</a> for what is stored.
	</p>

	<h2>Your content is yours</h2>
	<p>
		You keep the quizzes you write, and you can delete them or your whole account whenever you
		like. Something wrong? Email
		<a href="mailto:francois.prevot@frog.co">francois.prevot@frog.co</a>.
	</p>
	<!-- TODO: interim contact. Replace with the team's shared channel (Slack/Teams/mailing list) once one exists. -->

	<h2>The code</h2>
	<p>
		frogQuiz is a fork of <a href="https://github.com/mawoka-myblock/ClassQuiz">ClassQuiz</a>
		under the
		<a href="https://www.mozilla.org/en-US/MPL/2.0/" target="_blank" rel="noreferrer">MPL-2.0</a
		>. These terms cover the instance we run, not the source, which has its own licence.
	</p>
</article>
