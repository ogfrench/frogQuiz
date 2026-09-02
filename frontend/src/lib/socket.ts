// SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
//
// SPDX-License-Identifier: MPL-2.0

import { io } from 'socket.io-client';

// Same-origin by default (Docker/Caddy setup). On Netlify, WebSockets can't be
// proxied, so VITE_API_ORIGIN points the socket straight at the backend host.
const api_origin = import.meta.env.VITE_API_ORIGIN;

export const socket = api_origin ? io(api_origin, { withCredentials: true }) : io();
