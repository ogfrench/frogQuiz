// SPDX-FileCopyrightText: 2026 FrogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

/**
 * The answer palette: four hues taken from the frogConvert brand rainbow and
 * re-stepped into a soft band, so frogQuiz and frogConvert read as one product.
 *
 * Derived in OKLCH at L=0.76, C=0.13, keeping each brand hue:
 *   coral 22.8°, sky 231.1°, green 148.6°, violet 292.1°
 *
 * Those four hues are spaced 80-110° apart because closer pairs failed the
 * colour-vision check: the original amber/green pairing measured ΔE 8.6 for
 * normal vision, which is hard to tell apart even without a deficiency. This
 * set measures ΔE 17.1 at worst, and passes CVD separation and contrast
 * against both the light and dark surface.
 *
 * The same four values are used in both themes on purpose. A player learns
 * "I'm picking the coral one"; that identity must not shift when the host's
 * screen is in a different theme from their phone. The tiles carry dark text,
 * so they stay light in both.
 */
export const ANSWER_COLORS = ['#f98e8a', '#46bff4', '#72c882', '#b3a1fd'] as const;

/** Ink for text and shapes sitting on an answer tile. */
export const ANSWER_FOREGROUND = '#141414';

/** Colour for answer slot `i`, wrapping if a question somehow has more than four. */
export const answerColor = (i: number): string => ANSWER_COLORS[i % ANSWER_COLORS.length];
