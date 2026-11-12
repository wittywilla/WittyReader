// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// A seam of the app: what the server's renderer asks of the signed-in session. A standalone
// reader has one local profile and no libraries of a server.
export type AppState = { user: { id: number; isAdmin: boolean } | null; libraries: { id: number; type: string; name: string }[] }
const state: AppState = { user: { id: 1, isAdmin: false }, libraries: [] }
export const useApp = (): AppState => state
