import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { errMsg } from '../lib/format'

export default function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function sendCode(e) {
    e.preventDefault()
    const clean = email.trim().toLowerCase()
    setBusy(true); setError('')
    const { error } = await supabase.auth.signInWithOtp({ email: clean, options: { shouldCreateUser: true } })
    setBusy(false)
    if (error) setError(errMsg(error))
    else { setEmail(clean); setSent(true) }
  }

  async function verify(e) {
    e.preventDefault()
    setBusy(true); setError('')
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) setError('That code did not work. Check it or request a new one.')
  }

  return (
    <main className="page narrow login">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true" />
        <h1>SeatShare</h1>
        <p>Share the drive to work with colleagues on your route. Use your personal email; the pilot team approves each staff member before they can ride.</p>
      </div>
      {!sent ? (
        <form onSubmit={sendCode} className="form">
          <label>Your email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@gmail.com" autoComplete="email" />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send sign in code'}</button>
        </form>
      ) : (
        <form onSubmit={verify} className="form">
          <p>We sent a code to <strong>{email}</strong>. Enter it below.</p>
          <label>Sign in code
            <input inputMode="numeric" autoComplete="one-time-code" required value={code}
              onChange={(e) => setCode(e.target.value)} />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn" disabled={busy}>{busy ? 'Checking…' : 'Sign in'}</button>
          <button type="button" className="btn ghost" onClick={() => { setSent(false); setCode('') }}>
            Use a different email
          </button>
        </form>
      )}
    </main>
  )
}
