// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

// Copy link (V1 menus review, 17 Oct): My Quizzes' row menu and the view page copy the
// quiz's address so it can be pasted into a chat. The page does not change, so the
// result is said in one notice the layout draws once (ShareNotice.svelte).

export const share_notice: { text: string | null } = $state({ text: null });
let clear_timer: ReturnType<typeof setTimeout> | undefined;

const show = (text: string, ms: number) => {
	share_notice.text = text;
	clearTimeout(clear_timer);
	clear_timer = setTimeout(() => (share_notice.text = null), ms);
};

export const quizLink = (id: string, origin: string): string => `${origin}/view/${id}`;

/** `copied` and `failed` are the already-translated messages; `failed` gets the link. */
export const copyQuizLink = async (
	id: string,
	messages: { copied: string; failed: (url: string) => string }
): Promise<void> => {
	const url = quizLink(id, window.location.origin);
	try {
		await navigator.clipboard.writeText(url);
		show(messages.copied, 2500);
	} catch {
		// No clipboard (an insecure origin, a denied permission): give the link itself,
		// long enough to select by hand.
		show(messages.failed(url), 10000);
	}
};
