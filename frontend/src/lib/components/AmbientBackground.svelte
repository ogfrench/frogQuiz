<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

<script lang="ts">
	// frogConvert's signature: the brand rainbow diffused as soft out-of-focus
	// blobs behind the page, rather than saturated into any one element. One
	// fixed layer of radial gradients — no children, no motion, no interaction.
</script>

<div class="ambient" aria-hidden="true"></div>

<style>
	.ambient {
		position: fixed;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		background-repeat: no-repeat;
		/* Small, discrete smudges kept out towards the edges, so the middle of the
		   page — where content sits — stays clean. Large gradients read as a wash
		   over the whole viewport rather than as blobs. */
		/* Three stops per blob, not two: a single hard stop under heavy blur leaves
		   visible concentric banding. */
		background-image:
			radial-gradient(
				9rem 9rem at 7% 14%,
				rgba(107, 207, 127, 0.5),
				rgba(107, 207, 127, 0.16) 46%,
				transparent 72%
			),
			radial-gradient(
				7rem 7rem at 22% 66%,
				rgba(255, 179, 71, 0.36),
				rgba(255, 179, 71, 0.12) 46%,
				transparent 72%
			),
			radial-gradient(
				8rem 8rem at 90% 22%,
				rgba(79, 195, 247, 0.44),
				rgba(79, 195, 247, 0.14) 46%,
				transparent 72%
			),
			radial-gradient(
				6rem 6rem at 77% 8%,
				rgba(255, 217, 61, 0.34),
				rgba(255, 217, 61, 0.11) 46%,
				transparent 72%
			),
			radial-gradient(
				8rem 8rem at 84% 78%,
				rgba(151, 117, 250, 0.38),
				rgba(151, 117, 250, 0.12) 46%,
				transparent 72%
			),
			radial-gradient(
				6rem 6rem at 13% 90%,
				rgba(255, 107, 157, 0.32),
				rgba(255, 107, 157, 0.1) 46%,
				transparent 72%
			),
			radial-gradient(
				5rem 5rem at 52% 95%,
				rgba(79, 195, 247, 0.26),
				rgba(79, 195, 247, 0.09) 46%,
				transparent 72%
			);
		/* Heavy blur is what turns them from circles into out-of-focus colour. */
		filter: blur(56px);
		opacity: 0.55;
	}

	/* The same hues sit far lower against a dark ground, or they glow. */
	:global(html.dark) .ambient {
		opacity: 0.3;
	}
</style>
