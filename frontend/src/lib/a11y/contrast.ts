// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

/**
 * WCAG contrast maths, in a module rather than a throwaway script, so the colour
 * decisions this project has already made can be asserted in CI instead of re-checked
 * by eye every time somebody nudges a token.
 *
 * Everything here is pure and runs in Node: no canvas, no browser. That matters,
 * because a colour guard that needs a browser is a guard that gets skipped.
 */

export type RGB = [number, number, number];

/** `#rgb` or `#rrggbb` to 0-255 channels. */
export const hexToRgb = (hex: string): RGB => {
	const h = hex.replace('#', '').trim();
	const full =
		h.length === 3
			? h
					.split('')
					.map((c) => c + c)
					.join('')
			: h;
	if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`not a hex colour: ${hex}`);
	return [
		parseInt(full.slice(0, 2), 16),
		parseInt(full.slice(2, 4), 16),
		parseInt(full.slice(4, 6), 16)
	];
};

/**
 * `oklch(L C H)` to sRGB, because the theme tokens are written in OKLCH and the
 * browser is the only other thing that knows how to resolve them.
 *
 * OKLCH -> OKLab -> LMS -> linear sRGB -> gamma-encoded sRGB, per Björn Ottosson's
 * reference conversion. Values outside the sRGB gamut are clipped, which is what a
 * display does anyway.
 */
export const oklchToRgb = (css: string): RGB => {
	const m = css.match(/oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/i);
	if (!m) throw new Error(`not an oklch colour: ${css}`);
	const L = m[1].endsWith('%') ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
	const C = parseFloat(m[2]);
	const H = (parseFloat(m[3]) * Math.PI) / 180;

	const a = C * Math.cos(H);
	const b = C * Math.sin(H);

	const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
	const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
	const s_ = L - 0.0894841775 * a - 1.291485548 * b;

	const l = l_ * l_ * l_;
	const mm = m_ * m_ * m_;
	const s = s_ * s_ * s_;

	const lin = [
		4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s
	];

	const encode = (v: number) => {
		const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
		return Math.max(0, Math.min(255, Math.round(c * 255)));
	};
	return [encode(lin[0]), encode(lin[1]), encode(lin[2])] as RGB;
};

/** Accepts either notation, so callers do not have to care how a token is written. */
export const toRgb = (css: string): RGB =>
	css.trim().startsWith('#') ? hexToRgb(css) : oklchToRgb(css);

/** WCAG 2.x relative luminance. */
export const luminance = ([r, g, b]: RGB): number => {
	const f = (c: number) => {
		const v = c / 255;
		return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

/** WCAG 2.x contrast ratio, 1:1 to 21:1. Order of arguments does not matter. */
export const contrastRatio = (a: string | RGB, b: string | RGB): number => {
	const ra = typeof a === 'string' ? toRgb(a) : a;
	const rb = typeof b === 'string' ? toRgb(b) : b;
	const [hi, lo] = [luminance(ra), luminance(rb)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
};

/**
 * The AA threshold for a given size. "Large" is 24px, or 18.66px at 700 weight,
 * per WCAG 1.4.3.
 */
export const aaThreshold = (px: number, weight = 400): number =>
	px >= 24 || (px >= 18.66 && weight >= 700) ? 3 : 4.5;

/** Perceptual distance in OKLab, for telling two answer colours apart. */
export const deltaE = (a: string, b: string): number => {
	const lab = (css: string) => {
		const m = css.match(/oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/i);
		let L: number, C: number, H: number;
		if (m) {
			L = m[1].endsWith('%') ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
			C = parseFloat(m[2]);
			H = (parseFloat(m[3]) * Math.PI) / 180;
		} else {
			// Round-trip a hex through linear sRGB into OKLab.
			const [r, g, bb] = hexToRgb(css).map((v) => {
				const c = v / 255;
				return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
			});
			const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * bb);
			const mm = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * bb);
			const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * bb);
			return [
				0.2104542553 * l + 0.793617785 * mm - 0.0040720468 * s,
				1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s,
				0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s
			];
		}
		return [L, C * Math.cos(H), C * Math.sin(H)];
	};
	const [l1, a1, b1] = lab(a);
	const [l2, a2, b2] = lab(b);
	// Scaled to roughly CIE2000 units so the numbers read the way people expect.
	return Math.hypot(l1 - l2, a1 - a2, b1 - b2) * 100;
};

/**
 * Simulate the three dichromacies, so "can a player tell these two tiles apart" can be
 * asserted rather than assumed. Viénot, Brettel and Mollon's linear-RGB projection,
 * which is the standard approximation and is what the usual online simulators use.
 *
 * Answer identity does not rest on colour alone -- every tile also carries a distinct
 * shape -- but colour is what people actually use, so it has to survive on its own.
 */
const CVD: Record<'protanopia' | 'deuteranopia' | 'tritanopia', number[]> = {
	protanopia: [
		0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998
	],
	deuteranopia: [
		0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881
	],
	tritanopia: [
		1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.303956
	]
};

export const simulateCvd = (css: string, kind: keyof typeof CVD): RGB => {
	const m = CVD[kind];
	const lin = toRgb(css).map((v) => {
		const c = v / 255;
		return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
	});
	const out: number[] = [];
	for (let i = 0; i < 3; i++) {
		const v = m[i * 3] * lin[0] + m[i * 3 + 1] * lin[1] + m[i * 3 + 2] * lin[2];
		const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
		out.push(Math.max(0, Math.min(255, Math.round(c * 255))));
	}
	return out as RGB;
};

/** Straight-line distance in sRGB, for comparing two simulated colours. */
export const rgbDistance = (a: RGB, b: RGB): number =>
	Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
