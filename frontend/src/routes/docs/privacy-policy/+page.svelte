<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<svelte:head>
	<title>Privacy — frogQuiz</title>
	<meta
		name="description"
		content="What frogQuiz stores, who processes it and how to delete it."
	/>
</svelte:head>

<article
	class="prose prose-sm sm:prose lg:prose-lg xl:prose-xl mx-auto mt-10 prose-slate px-4 dark:prose-invert"
>
	<h1>Privacy</h1>
	<p>
		We use your data to run frogQuiz. We do not sell personal data or use advertising, analytics
		or cross-site tracking.
	</p>

	<h2>What we store</h2>
	<ul>
		<li>Account details, including your email address, username and sign-in records.</li>
		<li>Quizzes, uploaded images and game results saved by a host.</li>
		<li>Temporary game data, including players' nicknames, answers and scores.</li>
		<li>Session and rate-limit records, which can include your IP address.</li>
		<li>
			AI agent keys you create on My Account: a name, the first characters, a fingerprint of
			the key (never the key itself), and when it was made and last used.
		</li>
	</ul>
	<p>
		Sign-in uses an emailed link or code. Cookies and browser storage remember your session,
		guest quiz access, drafts and preferences. Clearing browser data can remove access to guest
		quizzes that have not been added to an account.
	</p>
	<p>
		Hosts can see players' nicknames, answers and scores. Quiz visibility and game settings
		determine what other users and participants can see.
	</p>

	<h2>Where data is processed</h2>
	<ul>
		<li>Netlify hosts the website and handles web requests.</li>
		<li>
			Oracle Cloud runs the backend and stores uploaded images and temporary session and game
			data.
		</li>
		<li>Neon stores account details, quizzes and saved game results.</li>
		<li>Resend delivers sign-in emails and processes the recipient's address and message.</li>
		<li>
			GitHub keeps encrypted nightly backups of the database and uploaded images for 30 days.
		</li>
	</ul>
	<p>Hosting providers may keep operational logs, including IP addresses.</p>
	<p>
		If you connect an AI agent with a key, the agent and the company that runs it receive
		whatever quizzes it reads or creates for you, under your own agreement with them. Revoke a
		key on My Account and it stops working on its next request.
	</p>

	<h2>Retention and deletion</h2>
	<p>
		Guest quizzes expire after 30 days unless added to an account. Account quizzes have no
		automatic expiry. Live game sessions are temporary; results saved by a host remain with the
		host's account.
	</p>
	<p>
		You can delete individual quizzes or delete your account in account settings. Account
		deletion removes the account and its quizzes, uploads, saved results and AI agent keys. Our
		backups keep a copy for up to 30 days; providers' own backups follow their retention
		policies.
	</p>
	<p>
		For privacy questions or a deletion request, email
		<a href="mailto:francois.prevot@frog.co">francois.prevot@frog.co</a>.
	</p>
</article>
