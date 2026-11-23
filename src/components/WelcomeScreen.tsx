/** First run: the owner names the workspace and optionally loads samples. */

import { useState, type FormEvent } from 'react'
import { useToast } from '@/components/ui'
import { usePageTitle } from '../hooks/usePageTitle'
import { callAction } from '../lib/api'
import { Logo } from './icons'
import { ThemeToggle } from './ThemeToggle'

export default function WelcomeScreen() {
  const [name, setName] = useState('Northwind Ops')
  usePageTitle('Welcome')
  const [samples, setSamples] = useState(true)
  const [invalid, setInvalid] = useState(false)
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const { success } = useToast()

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setInvalid(true)
      document.getElementById('wsName')?.focus()
      return
    }
    setBusy(true)
    setServerError(null)
    const res = await callAction<{ documentIds: string[] }>('setupWorkspace', { name: name.trim(), loadSamples: samples })
    setBusy(false)
    if (!res.success) {
      setServerError(res.error)
      return
    }
    success(`Created ${name.trim()}`, samples ? 'The sample documents are being indexed.' : undefined)
    // The workspace row arrives over the live socket and the gate re-renders.
  }

  return (
    <>
      <ThemeToggle floating />
      <div className="single">
        <main className="panel" data-testid="welcome">
          <Logo />
          <h1>Set up your workspace</h1>
          <p>You&apos;ll be the owner. You can approve teammates and upload documents next.</p>
          <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="field">
              <label htmlFor="wsName">Workspace name</label>
              <input
                className="input"
                id="wsName"
                value={name}
                maxLength={80}
                aria-invalid={invalid}
                aria-describedby={invalid ? 'wsHelp wsErr' : 'wsHelp'}
                onChange={(e) => {
                  setName(e.target.value)
                  if (e.target.value.trim()) setInvalid(false)
                }}
              />
              <span className="field-help" id="wsHelp">
                Usually your team or company name.
              </span>
              {invalid && (
                <span className="field-error" id="wsErr">
                  Enter a workspace name.
                </span>
              )}
            </div>
            <label className="check-row">
              <input type="checkbox" checked={samples} onChange={(e) => setSamples(e.target.checked)} />
              <div>
                <b>Start with sample documents</b>
                <span>
                  Three short policies for the fictional company Northwind Ops, so you can try questions right away. You
                  can delete them later.
                </span>
              </div>
            </label>
            {serverError && (
              <div className="banner" role="alert" style={{ marginTop: 0 }}>
                <div>
                  <b>Couldn&apos;t create the workspace</b>
                  {serverError}
                </div>
              </div>
            )}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? 'Creating workspace…' : 'Create workspace'}
            </button>
          </form>
        </main>
      </div>
    </>
  )
}
