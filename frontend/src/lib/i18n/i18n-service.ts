// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import i18next from 'i18next';
import en from './locales/en.json';

import type { i18n } from 'i18next';

// frogQuiz ships English only. The 33 other locale files inherited from upstream
// were stale -- new keys were never translated into them, so they resolved through
// fallbackLng anyway -- and the browser language detector could flip the whole UI
// into one of them off an Accept-Language header nobody set deliberately.
// The $t() indirection stays so the strings remain in one file rather than
// scattered across 44 routes; adding a locale back means a JSON file and a line here.
export class I18nService {
	i18n: i18n;

	constructor() {
		this.i18n = i18next;
		this.initialize();
	}

	t(key: string, replacements?: Record<string, unknown>): string {
		return this.i18n.t(key, replacements);
	}

	initialize(): void {
		this.i18n.init({
			lng: 'en',
			compatibilityJSON: 'v4',
			fallbackLng: 'en',
			debug: false,
			defaultNS: 'translation',
			interpolation: {
				escapeValue: false
			},
			returnEmptyString: false,
			simplifyPluralSuffix: true
		});
		this.i18n.addResourceBundle('en', 'translation', en);
	}
}
