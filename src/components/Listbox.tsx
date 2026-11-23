/**
 * Custom dropdown from design/prototype.html: a button that opens a listbox
 * popover. Replaces native <select> (the prototype bans native select styling).
 *
 * Keyboard: on the button, Enter/Space/ArrowDown/ArrowUp open it. In the open
 * list, ArrowUp/ArrowDown/Home/End move, Enter/Space choose, Escape closes,
 * Tab closes. Choosing or Escape returns focus to the button. Clicking outside
 * closes it. The list uses aria-activedescendant, so focus stays on the list.
 */

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { I } from './icons'

export interface ListboxOption<T extends string> {
  value: T
  label: string
  description?: string
}

export function Listbox<T extends string>({
  value,
  options,
  label,
  onChange,
  disabled,
  testId,
}: {
  value: T
  options: readonly ListboxOption<T>[]
  /** Accessible name, e.g. "Role for Lena Park". */
  label: string
  onChange: (value: T) => void
  disabled?: boolean
  testId?: string
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrap = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value))
  const current = options[selectedIndex]

  useEffect(() => {
    if (!open) return
    list.current?.focus({ preventScroll: true })
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function show(at = selectedIndex) {
    if (disabled) return
    setActive(at)
    setOpen(true)
  }

  function close(focusButton: boolean) {
    setOpen(false)
    if (focusButton) button.current?.focus()
  }

  function choose(i: number) {
    const o = options[i]
    close(true)
    if (o && o.value !== value) onChange(o.value)
  }

  function onButtonKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      show(selectedIndex)
    }
  }

  function onListKey(e: KeyboardEvent<HTMLUListElement>) {
    const last = options.length - 1
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActive((a) => Math.min(last, a + 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActive((a) => Math.max(0, a - 1))
        break
      case 'Home':
        e.preventDefault()
        setActive(0)
        break
      case 'End':
        e.preventDefault()
        setActive(last)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        choose(active)
        break
      case 'Escape':
        e.preventDefault()
        e.stopPropagation()
        close(true)
        break
      case 'Tab':
        close(false)
        break
    }
  }

  return (
    <div className="dd" ref={wrap}>
      <button
        ref={button}
        type="button"
        className="dd-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-label={`${label}: ${current?.label ?? ''}`}
        disabled={disabled}
        data-testid={testId}
        onClick={() => (open ? close(false) : show())}
        onKeyDown={onButtonKey}
      >
        <span>{current?.label}</span>
        {I.chev}
      </button>
      {open && (
        <ul
          ref={list}
          id={`${id}-list`}
          className="dd-menu"
          role="listbox"
          aria-label={label}
          tabIndex={-1}
          aria-activedescendant={`${id}-opt-${active}`}
          onKeyDown={onListKey}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={o.value === value}
              className={i === active ? 'active' : undefined}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(i)}
            >
              <span className="dd-check">{o.value === value ? I.tick : null}</span>
              <span>
                <b>{o.label}</b>
                {o.description && <small>{o.description}</small>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
