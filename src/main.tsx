// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@wittywilla/wittyink/kit.css'
import './app.css'
import App from './App'
import { startTheme } from './theme'

// The service worker serves unpacked EPUBs and keeps the app working offline.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {})

startTheme()
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
