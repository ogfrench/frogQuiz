<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	import { onMount } from 'svelte';
	import '$lib/hljs.css';

	onMount(async () => {
		const { default: hljs } = await import('highlight.js/lib/common');
		hljs.highlightAll();
	});
</script>

<svelte:head>
	<title>frogQuiz/docs - Privacy policy</title>
	<meta
		name="description"
		content="What data frogQuiz stores, why, and how to have it deleted."
	/>
</svelte:head>

<article
	class="prose prose-sm sm:prose lg:prose-lg xl:prose-xl mx-auto mt-10 prose-slate px-4 dark:prose-invert"
>
	<h1>Privacy</h1>

	<h2>We do not track you</h2>
	<p>
		No analytics. No error reporting to anyone else. No advertising cookies, and nothing that
		follows you to other sites. Upstream shipped Plausible analytics and Sentry error reporting;
		both were removed.
	</p>

	<h2>What we store</h2>
	<ul>
		<li>Your email, username and hashed password, so you can sign in.</li>
		<li>The quizzes you write and the images you put in them.</li>
		<li>Nicknames, answers and scores from games you host.</li>
		<li>A session and a rate-limit counter, which include your IP address.</li>
	</ul>
	<p>
		The site is served by Netlify. Everything else runs on one server we operate: Postgres for
		the data, Redis for sessions, Meilisearch for search, and disk or object storage for images.
	</p>

	<h2>Getting rid of it</h2>
	<p>
		Deleting your account in settings takes your quizzes and uploads with it. Quizzes made
		without an account delete themselves after 30 days. If you would rather ask, email
		<a href="mailto:francois.prevot@frog.co">francois.prevot@frog.co</a>.
	</p>
	<!-- TODO: interim contact. Replace with the team's shared channel (Slack/Teams/mailing list) once one exists. -->

	<h2>Who else sees any of it</h2>
	<p>
		Confirmation and password-reset emails are sent through Resend. They handle the delivery, so
		they see your address and the link in the message. That is all they get, and it is all they
		are used for.
	</p>
	<p>
		A host can switch on a captcha for joining a game, which loads hCaptcha or Google reCAPTCHA
		depending on configuration. Neither is enabled by default, and with none configured nothing
		is sent to either.
	</p>
</article>
