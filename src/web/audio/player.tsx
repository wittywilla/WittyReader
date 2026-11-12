// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// A seam of the app: the server's renderer marks the track that is playing. The reader plays no audio.
export const useAudio = (): { current: { id?: number } | null; playing: boolean } => ({ current: null, playing: false })
