/**
 * Light / dark / system theme. "system" (the default) leaves <html> without a
 * data-theme attribute so the CSS media query decides; a manual choice is
 * stored in localStorage and set as data-theme. index.html applies the stored
 * choice before first paint.
 */

import { useSyncExternalStore } from 'react'

export type ThemeChoice = 'system' | 'light' | 'dark'
const KEY = 'gw-theme'
const listeners = new Set<() => void>()

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

let current: ThemeChoice = typeof window === 'undefined' ? 'system' : read()

function systemDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function setTheme(choice: ThemeChoice) {
  current = choice
  try {
    if (choice === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, choice)
  } catch {
    // Private mode or blocked storage: the choice still applies for this visit.
  }
  if (choice === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', choice)
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', listener)
  return () => {
    listeners.delete(listener)
    mq.removeEventListener('change', listener)
  }
}

/** The stored choice and the theme actually showing. */
export function useTheme(): { choice: ThemeChoice; effective: 'light' | 'dark' } {
  const choice = useSyncExternalStore(subscribe, () => current, () => 'system' as ThemeChoice)
  const dark = useSyncExternalStore(subscribe, systemDark, () => false)
  const effective = choice === 'system' ? (dark ? 'dark' : 'light') : choice
  return { choice, effective }
}
