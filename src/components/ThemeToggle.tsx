import { useToast } from '@/components/ui'
import { setTheme, useTheme, type ThemeChoice } from '../theme'
import { I } from './icons'

/** Light/dark toggle for the top bar and signed-out screens. */
export function ThemeToggle({ floating = false }: { floating?: boolean }) {
  const { effective } = useTheme()
  const { info } = useToast()
  const next = effective === 'dark' ? 'light' : 'dark'
  const label = `Switch to ${next} mode`
  return (
    <button
      type="button"
      className={`theme-btn${floating ? ' theme-float' : ''}`}
      aria-label={label}
      title={label}
      data-testid="theme-toggle"
      onClick={() => {
        setTheme(next)
        info(`${next === 'dark' ? 'Dark' : 'Light'} mode`, 'Choose System in your account menu to follow your device.')
      }}
    >
      {effective === 'dark' ? I.sun : I.moon}
    </button>
  )
}

/** System / Light / Dark segmented control for the account menu. */
export function ThemeChooser() {
  const { choice } = useTheme()
  const options: ThemeChoice[] = ['system', 'light', 'dark']
  return (
    <div className="seg" role="group" aria-label="Theme">
      {options.map((t) => (
        <button key={t} type="button" aria-pressed={choice === t} onClick={() => setTheme(t)}>
          {t[0].toUpperCase() + t.slice(1)}
        </button>
      ))}
    </div>
  )
}
