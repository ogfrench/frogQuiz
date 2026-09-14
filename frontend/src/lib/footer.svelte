<script>
	import LanguageToggle from './language-toggle.svelte';
</script>

<footer
	class="border-border bg-muted text-muted-foreground flex w-full flex-col items-center border-t py-6 text-center text-sm"
>
	<div class="mb-4">
		<LanguageToggle />
	</div>
	<p>
		Designed with ❤️ by François &amp; Gonçalo.
		<br />
		<a
			href="https://github.com/ogfrench/frogQuiz"
			target="_blank"
			class="fq-touch-target hover:text-foreground relative inline-flex min-h-11 items-center underline underline-offset-4 transition-colors"
			>GitHub</a
		>
	</p>
</footer>
