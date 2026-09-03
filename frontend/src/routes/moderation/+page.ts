// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
//
// SPDX-License-Identifier: MPL-2.0
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// Moderation is hidden for this internal deployment (see CLAUDE.md). To restore, swap this
// stub back for the original load function that fetched /api/v1/moderation/quizzes.
export const load = (() => {
	error(404);
}) satisfies PageLoad;
