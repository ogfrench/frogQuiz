<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<!--
	Never rendered: +page.ts always redirects to /explore. SvelteKit requires a page
	component for the route to exist at all, and the route has to keep existing so
	shared /search?q=… links resolve.

	The 119 lines that used to be here -- a client fetch, an onMount, a hand-rolled
	history.pushState and a hardcoded English empty state -- were deleted rather than
	ported. /explore does all of it from its load function now.
-->
