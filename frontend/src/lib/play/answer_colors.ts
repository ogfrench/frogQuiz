// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

/**
 * The answer palette: four hues taken from the frogConvert brand rainbow and
 * re-stepped into a soft band, so frogQuiz and frogConvert read as one product.
 *
 * Derived in OKLCH at L=0.76, C=0.13, keeping each brand hue:
 *   coral 22.8°, sky 231.1°, green 148.6°, violet 292.1°
 *
 * Those four hues are spaced 80-110° apart because closer pairs were hard to
 * tell apart even with normal vision: an earlier amber/green pairing measured
 * ΔE 8.6. This set measures 13.2 at worst (sky against violet) and 25.2 at
 * best, and every tile clears AA for its ink.
 *
 * What this palette does NOT do is survive colour-vision deficiency on its own,
 * and an earlier version of this comment claimed otherwise. Simulated, the
 * distances collapse: under deuteranopia coral and green differ by 4 of 255,
 * and sky and violet by 9. Four hues at one lightness cannot be separated by a
 * dichromat, because hue is most of what they have lost -- keeping them apart
 * would mean spreading them across lightness instead, which is a different
 * palette from this one.
 *
 * That is survivable only because colour is never the sole channel here. Every
 * tile also carries a distinct shape (triangle, diamond, circle, square) in the
 * same position on the host screen and the player's phone, and the host screen
 * carries the answer text as well. WCAG 1.4.1 asks that colour not be the only
 * visual means of conveying information, and it is not. If the shapes are ever
 * removed, this palette stops being accessible and has to be redesigned around
 * lightness. See answer_colors.test.ts, which pins both halves of that.
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
