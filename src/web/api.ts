// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// A seam of the app, not a copy: the server's renderer asks its api module where pictures are.
// A standalone WittyReader has no server; a picture's address is one the app made itself (a
// cover kept on the device), which `localPicture` answers from what the page provider
// registered (src/pages/pictures.ts), and anything else is the address as it is.
import { pictureUrl } from '../pages/pictures'

export const serverBase = () => ''
export const mediaUrl = (path: string) => pictureUrl(path)
