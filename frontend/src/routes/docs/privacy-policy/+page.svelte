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
	<h1>Privacy Policy</h1>

	<p>
		frogQuiz is an internal quiz tool run by François and Gonçalo. This page says what it
		stores, where, for how long, and how to have it removed.
	</p>

	<h2>What gets stored, where, and for how long</h2>
	<table>
		<thead>
			<tr>
				<th>What</th>
				<th>Why</th>
				<th>How long</th>
				<th>Where</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td>Account details: email address, username, hashed password</td>
				<td>To let you sign in and own the quizzes you create</td>
				<td>Until you delete your account, then at most 30 days</td>
				<td>Postgres, on the backend server</td>
			</tr>
			<tr>
				<td>Quizzes you create, and the images you upload to them</td>
				<td>They are the thing the app is for</td>
				<td>Until you delete them, or 30 days after you delete your account</td>
				<td>Postgres, plus object storage for images</td>
			</tr>
			<tr>
				<td>Quizzes created without an account</td>
				<td>So you can build and host one without signing up</td>
				<td>30 days from creation, then deleted automatically along with their images</td>
				<td>Postgres, plus object storage for images</td>
			</tr>
			<tr>
				<td>Game results: nicknames players typed, their answers and scores</td>
				<td>To show the leaderboard during a game, and the results afterwards</td>
				<td>Until the host deletes them</td>
				<td>Postgres</td>
			</tr>
			<tr>
				<td>Sessions and login tokens</td>
				<td>To keep you signed in, and to invalidate tokens when you sign out</td>
				<td
					>Access tokens expire after 30 minutes; sessions when you sign out or they lapse</td
				>
				<td>Redis</td>
			</tr>
			<tr>
				<td>Your IP address</td>
				<td
					>Rate limiting, and recorded against login sessions so you can spot one you do
					not recognise</td
				>
				<td
					>Rate-limit counters expire within the hour; the session record goes when the
					session does</td
				>
				<td>Redis and Postgres</td>
			</tr>
			<tr>
				<td>Quiz titles and descriptions of public quizzes</td>
				<td>To make them findable in search</td>
				<td>Until the quiz is deleted or made private</td>
				<td>Meilisearch, on the backend server</td>
			</tr>
		</tbody>
	</table>

	<h2>Where the servers are</h2>
	<p>
		The website is served by <a href="https://www.netlify.com/" target="_blank" rel="noreferrer"
			>Netlify</a
		>, which receives the requests your browser makes for the pages and handles them under its
		own privacy terms. Everything else — the API, the live game connection, Postgres, Redis,
		Meilisearch and uploaded images — runs on a single server we operate ourselves.
	</p>

	<h2>Cookies</h2>
	<p>
		Cookies hold your access token, your session and your preferences, such as the theme. They
		are not used for advertising or for tracking you across other sites.
	</p>

	<h2>Tracking</h2>
	<p>
		There is none. No analytics, no usage data, nothing sent to an analytics provider. Errors
		are logged on our own server only — no stack traces or request details go to any third
		party. Upstream shipped Plausible analytics and Sentry error reporting; both were removed.
	</p>

	<h2>Third parties</h2>
	<p>
		Only one, and it is switched off by default: a quiz host can turn on a captcha for joining a
		game, which loads
		<a href="https://www.hcaptcha.com/" target="_blank" rel="noreferrer">hCaptcha</a> or Google reCAPTCHA
		depending on how the instance is configured. Whichever is enabled receives whatever that provider
		collects, under its own privacy policy. With no captcha configured — the default — nothing is
		sent to either.
	</p>

	<h2>Getting your data removed</h2>
	<p>
		Deleting your account from the settings page removes it, your quizzes and your uploads. If
		you would rather ask, or you want to know what is held about you, email
		<a href="mailto:francois.prevot@frog.co">francois.prevot@frog.co</a>.
	</p>
	<!-- TODO: interim contact. Replace with the team's shared channel (Slack/Teams/mailing list) once one exists. -->
</article>
