// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

export async function load({ parent, url }) {
	// No login wall here. An anonymous user can create a quiz and the backend will
	// start a game for them, but this page used to bounce them to /account/login --
	// so the account-free path dead-ended at the one screen that hosts the game.
	// The wall was never the access control either: `register_as_admin` accepts any
	// valid pin + game_id pair from anyone, signed in or not.
	//
	// `signed_in` is returned rather than read from the `signedIn` store because the
	// store is module-scope state mutated during SSR (lib/stores.ts), so it is not
	// safe to base a rendering decision on.
	const { email } = await parent();
	const token = url.searchParams.get('token');
	const pin = url.searchParams.get('pin');
	let auto_connect = url.searchParams.get('connect') !== null;
	if (token === null || pin === null) {
		auto_connect = false;
	}
	return {
		game_pin: pin === null ? '' : pin,
		game_token: token === null ? '' : token,
		auto_connect,
		signed_in: !!email
	};
}
