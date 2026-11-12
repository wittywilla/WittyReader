// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
import data from './settings.json' with { type: 'json' }

// The reader modules' settings as the profile has them (see scripts/sync-modules.mjs): defaults from each module's sdui.json,
// then what this device saved. The readers get them through `ReaderHost.settings`; Settings draws the same rows.
export type Row = { key: string; kind: 'bool' | 'enum' | 'int' | 'string'; label: string; help?: string; default?: unknown; options?: { value: string; label: string }[]; min?: number; max?: number; unit?: string; maxLength?: number }
export type Group = { title: string; footer?: string; rows: Row[] }
export type ModuleSettings = { id: string; title: string; groups: Group[] }
export const MODULES = Object.values((data as unknown as { modules: Record<string, ModuleSettings> }).modules)
const KEY = 'wittyreader.settings.'
const rows = (module: string) => MODULES.find((m) => m.id === module)?.groups.flatMap((g) => g.rows) || []

const read = (module: string): Record<string, unknown> => { try { const v = JSON.parse(localStorage.getItem(KEY + module) || '{}'); return v && typeof v === 'object' ? v : {} } catch { return {} } }

/** A value as its row allows it: the right kind, within its range and options; else undefined. */
export function clean(row: Row, v: unknown): unknown {
  switch (row.kind) {
    case 'bool': return typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : undefined
    case 'int': { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) && v !== '' ? Math.min(row.max ?? n, Math.max(row.min ?? n, Math.round(n))) : undefined }
    case 'enum': return row.options?.some((o) => o.value === v) ? v : undefined
    default: return typeof v === 'string' ? v.slice(0, row.maxLength ?? 200) : undefined
  }
}

/** What is saved, defaults included. */
export function getSettings(module: string): Record<string, unknown> {
  const saved = read(module)
  return Object.fromEntries(rows(module).map((r) => { const v = clean(r, saved[r.key]); return [r.key, v !== undefined ? v : r.default] }).filter(([, v]) => v !== undefined))
}
/** Keeps the changes a reader or Settings makes: only keys the module has, only values its rows allow. */
export function saveSettings(module: string, values: Record<string, unknown>) {
  const saved = read(module)
  for (const r of rows(module)) if (r.key in values) { const v = clean(r, values[r.key]); if (v !== undefined) saved[r.key] = v }
  try { localStorage.setItem(KEY + module, JSON.stringify(saved)) } catch { /* this visit only */ }
}
export const settingRow = (module: string, key: string) => rows(module).find((r) => r.key === key)
