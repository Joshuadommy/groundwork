/** Icons from design/prototype.html. Decorative: always aria-hidden. */

import type { ReactElement } from 'react'

const s = { 'aria-hidden': true, fill: 'none' } as const
const stroke = { stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export const I: Record<string, ReactElement> = {
  mark: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...s}>
      <path d="M2 12.5h12M4 9.5h8M6 6.5h4M8 2v4.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  chev: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...s}>
      <path d="M4 6l4 4 4-4" strokeWidth="1.6" {...stroke} />
    </svg>
  ),
  tick: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...s}>
      <path d="M3.5 8.5l3 3 6-7" strokeWidth="1.8" {...stroke} />
    </svg>
  ),
  send: (
    <svg width="18" height="18" viewBox="0 0 18 18" {...s}>
      <path d="M9 14.5v-11M4.5 8L9 3.5 13.5 8" strokeWidth="1.9" {...stroke} />
    </svg>
  ),
  ask: (
    <svg width="20" height="20" viewBox="0 0 20 20" {...s}>
      <path d="M4 5.5h12M4 10h8M4 14.5h5" strokeWidth="1.6" {...stroke} />
    </svg>
  ),
  doc: (
    <svg width="20" height="20" viewBox="0 0 20 20" {...s}>
      <path d="M6 2.8h5.5L15 6.3v10.9H6z" strokeWidth="1.6" {...stroke} />
      <path d="M11.3 3v3.5H15" strokeWidth="1.6" {...stroke} />
    </svg>
  ),
  evals: (
    <svg width="20" height="20" viewBox="0 0 20 20" {...s}>
      <path d="M3.5 10.5l3.5 3.5 9-9" strokeWidth="1.6" {...stroke} />
    </svg>
  ),
  team: (
    <svg width="20" height="20" viewBox="0 0 20 20" {...s}>
      <circle cx="7.5" cy="7" r="2.8" strokeWidth="1.6" stroke="currentColor" />
      <path d="M2.5 16c.6-2.6 2.6-4 5-4s4.4 1.4 5 4" strokeWidth="1.6" {...stroke} />
      <path d="M13 4.6a2.6 2.6 0 010 4.8M15 12.4c1.3.6 2.1 1.8 2.5 3.6" strokeWidth="1.6" {...stroke} />
    </svg>
  ),
  check: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...s}>
      <circle cx="8" cy="8" r="7" strokeWidth="1.5" stroke="currentColor" />
      <path d="M5 8.2l2 2 4-4.2" strokeWidth="1.5" {...stroke} />
    </svg>
  ),
  warn: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...s}>
      <path d="M8 1.8l6.6 11.7H1.4z" strokeWidth="1.5" {...stroke} />
      <path d="M8 6.3v3.3M8 11.6v.1" strokeWidth="1.5" {...stroke} />
    </svg>
  ),
  search: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...s}>
      <circle cx="7" cy="7" r="5" strokeWidth="1.5" stroke="currentColor" />
      <path d="M11 11l3.5 3.5" strokeWidth="1.5" {...stroke} />
    </svg>
  ),
  up: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...s}>
      <path d="M5 7.2V14H2.5V7.2zM5 7.2l3-5c1.1 0 1.8.8 1.6 1.9l-.5 2.4h3.6c.9 0 1.5.8 1.3 1.7l-1.1 4.6c-.2.7-.8 1.2-1.5 1.2H5" strokeWidth="1.4" {...stroke} />
    </svg>
  ),
  down: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...s}>
      <path d="M5 8.8V2H2.5v6.8zM5 8.8l3 5c1.1 0 1.8-.8 1.6-1.9l-.5-2.4h3.6c.9 0 1.5-.8 1.3-1.7l-1.1-4.6C12.7 2.5 12.1 2 11.4 2H5" strokeWidth="1.4" {...stroke} />
    </svg>
  ),
  x: (
    <svg width="18" height="18" viewBox="0 0 18 18" {...s}>
      <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" strokeWidth="1.6" {...stroke} />
    </svg>
  ),
  shield: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...s}>
      <path d="M8 1.5l5.5 2v4.2c0 3.3-2.3 5.9-5.5 6.8-3.2-.9-5.5-3.5-5.5-6.8V3.5z" strokeWidth="1.4" {...stroke} />
    </svg>
  ),
  trash: (
    <svg width="18" height="18" viewBox="0 0 18 18" {...s}>
      <path d="M3.5 5h11M7 5V3.5h4V5M5 5l.7 9.5h6.6L13 5" strokeWidth="1.5" {...stroke} />
    </svg>
  ),
  out: (
    <svg width="18" height="18" viewBox="0 0 18 18" {...s}>
      <path d="M7 3H3.5v12H7M11.5 5.5L15 9l-3.5 3.5M15 9H7" strokeWidth="1.5" {...stroke} />
    </svg>
  ),
  sun: (
    <svg width="18" height="18" viewBox="0 0 18 18" {...s}>
      <circle cx="9" cy="9" r="3.3" strokeWidth="1.5" stroke="currentColor" />
      <path d="M9 1.5v1.8M9 14.7v1.8M1.5 9h1.8M14.7 9h1.8M3.7 3.7l1.3 1.3M13 13l1.3 1.3M3.7 14.3L5 13M13 5l1.3-1.3" strokeWidth="1.5" {...stroke} />
    </svg>
  ),
  moon: (
    <svg width="18" height="18" viewBox="0 0 18 18" {...s}>
      <path d="M15 10.8A6.5 6.5 0 017.2 3a6.5 6.5 0 107.8 7.8z" strokeWidth="1.5" {...stroke} />
    </svg>
  ),
  left: (
    <svg width="18" height="18" viewBox="0 0 18 18" {...s}>
      <path d="M11 4L6 9l5 5" strokeWidth="1.6" {...stroke} />
    </svg>
  ),
  right: (
    <svg width="18" height="18" viewBox="0 0 18 18" {...s}>
      <path d="M7 4l5 5-5 5" strokeWidth="1.6" {...stroke} />
    </svg>
  ),
  plus: (
    <svg width="18" height="18" viewBox="0 0 18 18" {...s}>
      <path d="M9 4v10M4 9h10" strokeWidth="1.6" {...stroke} />
    </svg>
  ),
  minus: (
    <svg width="18" height="18" viewBox="0 0 18 18" {...s}>
      <path d="M4 9h10" strokeWidth="1.6" {...stroke} />
    </svg>
  ),
  download: (
    <svg width="18" height="18" viewBox="0 0 18 18" {...s}>
      <path d="M9 2.5v9M5.5 8L9 11.5 12.5 8M3 15h12" strokeWidth="1.5" {...stroke} />
    </svg>
  ),
  google: (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.7H9v3.3h4.8a4.1 4.1 0 01-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z" />
      <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 5.9-2.2L12 13.6c-.8.5-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H1v2.3A9 9 0 009 18z" />
      <path fill="#FBBC05" d="M4 10.8a5.4 5.4 0 010-3.5V5H1a9 9 0 000 8.1z" />
      <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3L15 2.4A9 9 0 001 5l3 2.3c.7-2.1 2.7-3.7 5-3.7z" />
    </svg>
  ),
  microsoft: (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#F25022" d="M1 1h7.5v7.5H1z" />
      <path fill="#7FBA00" d="M9.5 1H17v7.5H9.5z" />
      <path fill="#00A4EF" d="M1 9.5h7.5V17H1z" />
      <path fill="#FFB900" d="M9.5 9.5H17V17H9.5z" />
    </svg>
  ),
  apple: (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M13.4 9.6c0-1.9 1.6-2.8 1.6-2.9-.9-1.3-2.2-1.4-2.7-1.5-1.1-.1-2.2.7-2.8.7-.6 0-1.5-.7-2.5-.6-1.3 0-2.5.8-3.1 1.9-1.4 2.4-.4 5.9.9 7.8.7.9 1.4 2 2.4 1.9 1-.1 1.3-.6 2.5-.6s1.5.6 2.5.6c1 0 1.7-1 2.3-1.9.7-1.1 1-2.1 1-2.2 0 0-2-.8-2.1-3.2zM11.6 3.9c.5-.6.9-1.5.8-2.4-.8 0-1.7.5-2.3 1.1-.5.6-.9 1.5-.8 2.3.9.1 1.8-.4 2.3-1z"
      />
    </svg>
  ),
  github: (
    <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  ),
}

export function Logo({ href }: { href?: string }) {
  const inner = (
    <>
      <span className="logo-mark">{I.mark}</span>
      <span>Groundwork</span>
    </>
  )
  return href ? (
    <a className="logo" href={href}>
      {inner}
    </a>
  ) : (
    <div className="logo">{inner}</div>
  )
}
