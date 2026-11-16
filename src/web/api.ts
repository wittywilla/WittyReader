// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// A seam of the app, not a copy: the server's renderer asks its api module where pictures are.
// A standalone WittyReader has no server; a picture's address is one the app made itself (a
// cover kept on the device), which `localPicture` answers from what the page provider
// registered (src/pages/pictures.ts), and anything else is the address as it is.
import { pictureUrl } from '../pages/pictures'

export const serverBase = () => ''
export const mediaUrl = (path: string) => pictureUrl(path)

// What a person is called: their display name, else their sign-in name, as the server's own.
export const profileName = (u: Record<string, unknown>) => String(u.displayName || u.name || '')

// Settings a person keeps on a server (ui/userPrefs). A standalone reader has none: the copy
// userPrefs keeps on this device is the only one, so there is nothing to fetch and saving is done.
export const api = {
  get: async <T,>(_path: string): Promise<T> => ({}) as T,
  put: async (_path: string, _body?: unknown): Promise<void> => {},
}
