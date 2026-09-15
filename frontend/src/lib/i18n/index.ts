// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { I18nService } from './i18n-service';
import { I18NextTranslationService } from './translation-service';
import type { TType } from './translation-service';
import type { Readable } from 'svelte/store';
import { getContext, setContext } from 'svelte';

export type I18nContext = {
	t: Readable<TType>;
};
const CONTEXT_KEY = 't';
export const setLocalization = (context: I18nContext) => {
	return setContext<I18nContext>(CONTEXT_KEY, context);
};

// To make retrieving the t function easier.
export const getLocalization = () => {
	return getContext<I18nContext>(CONTEXT_KEY);
};

export const initLocalizationContext = (): { i18n: I18nService } => {
	const i18n = new I18nService();
	const translator = new I18NextTranslationService(i18n);

	// skipcq: JS-0357
	setLocalization({
		t: translator.translate
	});

	return {
		i18n
	};
};
