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
	<h1>Terms of Service</h1>

	<h2>The short version</h2>
	<ul>
		<li>frogQuiz is an internal tool. It is provided as-is, with no uptime guarantee.</li>
		<li>Do not put anything illegal, harmful or confidential into it.</li>
		<li>
			We will not publish or sell what you put in. We may remove content that breaks these
			rules.
		</li>
	</ul>

	<h2>What frogQuiz is</h2>
	<p>
		A quiz tool run by François and Gonçalo for internal use. It is not a commercial service and
		comes with no service-level guarantee: it may be unavailable, may lose data, and may be shut
		down. Keep a copy elsewhere of anything you would mind losing.
	</p>

	<h2>What does not belong here</h2>
	<p>
		Do not upload or create content that is illegal, harassing, pornographic, or that infringes
		someone else's rights. Do not put confidential or personal information about other people
		into a quiz — a quiz is visible to everyone playing it, and a public quiz is visible to
		anyone. Content that breaks these rules will be removed.
	</p>

	<h2>Reporting something</h2>
	<p>
		Email <a href="mailto:francois.prevot@frog.co">francois.prevot@frog.co</a> and we will look at
		it.
	</p>
	<!-- TODO: interim contact. Replace with the team's shared channel (Slack/Teams/mailing list) once one exists. -->

	<h2>What we may do</h2>
	<p>
		We may remove content that breaks the rules above, suspend an account being used to break
		them, and change or stop the service. We may look at stored data where we need to in order
		to keep the service running, fix a fault, or deal with a report.
	</p>
	<p>
		We will not publish your content or your personal data, and we will not sell or share either
		with anyone outside the team, except where we are legally required to. What is stored,
		where, and for how long is set out in the
		<a href="/docs/privacy-policy">privacy policy</a>.
	</p>

	<h2>What you may do</h2>
	<p>
		You keep ownership of the quizzes you write. You can delete your content or your whole
		account at any time from the settings page, or ask us to do it. Deleting your account
		removes your quizzes and uploads with it.
	</p>

	<h2>The software</h2>
	<p>
		frogQuiz is a fork of <a href="https://github.com/mawoka-myblock/ClassQuiz">ClassQuiz</a>,
		licensed under the
		<a href="https://www.mozilla.org/en-US/MPL/2.0/" target="_blank" rel="noreferrer">MPL-2.0</a
		>. These terms cover the instance we run, not the source code, which carries its own
		licence.
	</p>
</article>
