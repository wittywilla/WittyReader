// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './web/styles.css'
import './web/design2.css'
import './web/finish.css'
import './web/ui/ui.css'
import './web/sdui/sdui.css'
import '@wittywilla/wittyink/kit.css'
import './app.css'
import App from './App'
import { Scene } from './web/ui/Scene'
import { startTheme } from './theme/engine'

// The service worker serves unpacked EPUBs and keeps the app working offline.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {})

// The theme is applied before the first page, so there is no flash of the wrong colours.
void startTheme().finally(() => createRoot(document.getElementById('root')!).render(<StrictMode><Scene /><App /></StrictMode>))
