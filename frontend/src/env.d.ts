// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
//
// SPDX-License-Identifier: MPL-2.0

/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_GOOGLE_AUTH_ENABLED?: string;
	readonly VITE_GITHUB_AUTH_ENABLED?: string;
	readonly VITE_CAPTCHA_ENABLED?: string;
	readonly VITE_CUSTOM_OAUTH_NAME?: string;
	readonly VITE_REGISTRATION_DISABLED?: string;
	readonly VITE_HCAPTCHA?: string;
	readonly VITE_RECAPTCHA?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

// The captcha scripts /play loads when a game asks for one (lib/play/join.svelte).
interface Window {
	hcaptcha?: {
		render(container: string, params: Record<string, unknown>): string;
		execute(widgetId: string, params: { async: boolean }): Promise<{ response: string }>;
	};
}
declare const grecaptcha: {
	ready(callback: () => void): void;
	execute(siteKey: string, options: { action: string }): Promise<string>;
};
