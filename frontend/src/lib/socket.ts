// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
// SPDX-FileCopyrightText: 2026 frogQuiz contributors
//
// SPDX-License-Identifier: MPL-2.0

import { io } from 'socket.io-client';
import { browser } from '$app/environment';

// Same-origin by default (Docker/Caddy setup). On Netlify, WebSockets can't be
// proxied, so VITE_API_ORIGIN points the socket straight at the backend host.
const api_origin = import.meta.env.VITE_API_ORIGIN;

// SSR can render /play before another request reuses the same server instance.
// Connecting there fires player handlers that access sessionStorage and crashes the
// function. Only browser instances may open a connection.
export const socket = api_origin
	? io(api_origin, { withCredentials: true, autoConnect: browser })
	: io({ autoConnect: browser });
