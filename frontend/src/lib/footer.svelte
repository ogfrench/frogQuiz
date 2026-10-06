<!-- GitHub link hidden for the MVP (MVP.md §4.2); the repo is at
     https://github.com/ogfrench/frogQuiz if it comes back. The legal pages stay:
     registration links to two of them, and attribution is the upstream credit. -->
<!-- No band of its own (2026-10-04, François): it was a bg-muted strip, the one grey
     block on pages that are otherwise the page ground. Now one quiet line on the ground,
     with a hairline above it that mirrors the navbar's below, at the navbar's side
     padding, the way frogConvert's footer reads. The heart is the text glyph, as there,
     in the text color: the red emoji was the only color in the footer. -->
<footer class="border-border/60 text-muted-foreground border-t px-5 py-5 text-sm lg:px-8">
	<div
		class="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left"
	>
		<p>
			Designed with <span class="text-foreground" aria-hidden="true">&#x2665;&#xFE0E;</span
			><span class="sr-only">love</span> by François &amp; Gonçalo
		</p>
		<nav aria-label="Legal" class="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
			{#each [['/docs/tos', 'Terms of Service'], ['/docs/privacy-policy', 'Privacy'], ['/docs/attribution', 'Attribution']] as [href, label] (href)}
				<a
					{href}
					class="fq-touch-target hover:text-foreground relative inline-flex items-center underline-offset-4 transition-colors hover:underline"
					>{label}</a
				>
			{/each}
		</nav>
	</div>
</footer>
