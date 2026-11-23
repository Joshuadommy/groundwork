import { useEffect } from 'react'
import { APP_NAME } from '../constants'

/** "Ask · Groundwork". One owner per screen; set from an effect so it never competes with another <title>. */
export function pageTitle(title: string): string {
  return title && title !== APP_NAME ? `${title} · ${APP_NAME}` : APP_NAME
}

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = pageTitle(title)
  }, [title])
}
