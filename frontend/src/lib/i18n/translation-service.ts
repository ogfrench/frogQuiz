// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import type { I18nService } from './i18n-service';
import { readonly, writable } from 'svelte/store';
import type { Readable } from 'svelte/store';

// eslint-disable-next-line no-unused-vars
export type TType = (text: string, replacements?: Record<string, unknown>) => string;

export interface TranslationService {
	translate: Readable<TType>;
}

// With a single locale the translate function never changes, so this is a constant
// store rather than one derived from a locale that can no longer be switched.
// It stays a store because every call site reads it as `$t('some.key')`.
export class I18NextTranslationService implements TranslationService {
	public translate: Readable<TType>;

	constructor(i18n: I18nService) {
		i18n.initialize();
		this.translate = readonly(
			writable<TType>((key: string, replacements?: Record<string, unknown>) =>
				i18n.t(key, replacements)
			)
		);
	}
}
