import { useState } from 'react'
import { OFFICES } from '../lib/config'
import { errMsg } from '../lib/format'

export default function ProfileForm({ initial = {}, submitLabel, onSubmit, showTerms }) {
  const [f, setF] = useState({
    full_name: initial.full_name || '',
    staff_id: initial.staff_id || '',
    phone: initial.phone || '',
    office: initial.office || OFFICES[0],
    is_driver: initial.is_driver || false,
    emergency_name: initial.emergency_name || '',
    emergency_phone: initial.emergency_phone || ''
  })
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  async function submit(e) {
    e.preventDefault()
    if (showTerms && !agree) { setError('Accept the pilot terms to continue.'); return }
    setBusy(true); setError('')
    try { await onSubmit(f) } catch (err) { setError(errMsg(err)) } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="form">
      <label>Full name<input required value={f.full_name} onChange={set('full_name')} autoComplete="name" /></label>
      <label>Staff ID<input required value={f.staff_id} onChange={set('staff_id')} /></label>
      <label>Phone number<input required type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" /></label>
      <label>Your office
        <select value={f.office} onChange={set('office')}>
          {OFFICES.map((o) => <option key={o}>{o}</option>)}
        </select>
      </label>
      <fieldset>
        <legend>Emergency contact</legend>
        <p className="hint">Contacted if something goes wrong on a trip.</p>
        <label>Name<input required value={f.emergency_name} onChange={set('emergency_name')} /></label>
        <label>Phone<input required type="tel" value={f.emergency_phone} onChange={set('emergency_phone')} /></label>
      </fieldset>
      <label className="check">
        <input type="checkbox" checked={f.is_driver} onChange={set('is_driver')} />
        I also want to offer seats in my car
      </label>
      {showTerms && (
        <div className="terms">
          <p>This is a voluntary staff pilot. By joining you agree that:</p>
          <p>You travel at your own risk and will behave respectfully. You will be at your pickup point on time. You will pay the listed fare to the driver directly by mobile money or cash. If you drive, you hold a valid licence and insurance for your car.</p>
          <label className="check">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            I accept these terms
          </label>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
    </form>
  )
}
