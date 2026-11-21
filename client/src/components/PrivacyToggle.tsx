import { useState } from 'react'
import { profilesApi } from '../lib/api'

export function PrivacyToggle({ initial, onChanged }: { initial: boolean; onChanged?: (value: boolean) => void }) {
  const [value, setValue] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function toggle() {
    const next = !value
    setBusy(true)
    setError('')
    try {
      await profilesApi.setPrivacy(next)
      setValue(next)
      onChanged?.(next)
    } catch (err: any) {
      setError(err.message || 'Unable to update contact privacy')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <label className="toggle-row">
        <span>
          <strong>Share contact details</strong>
          <small>Accepted mentorship partners only</small>
        </span>
        <input type="checkbox" checked={value} onChange={() => void toggle()} disabled={busy} />
      </label>
      {error && <div className="alert error">{error}</div>}
    </>
  )
}
