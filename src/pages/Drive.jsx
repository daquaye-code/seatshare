import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { WEEKDAYS } from '../lib/config'
import { dateStr, errMsg, fmtDay, fmtFare, fmtTime, statusLabel } from '../lib/format'

const today = () => dateStr(new Date())

function VehicleForm({ vehicle, driverId, onSaved }) {
  const [f, setF] = useState({
    make: vehicle?.make || '', colour: vehicle?.colour || '', plate: vehicle?.plate || '',
    seats: vehicle?.seats || 3, licence_expiry: vehicle?.licence_expiry || '', insurance_expiry: vehicle?.insurance_expiry || ''
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function save(e) {
    e.preventDefault()
    setBusy(true); setError('')
    const payload = { ...f, seats: Number(f.seats), plate: f.plate.toUpperCase().trim() }
    const q = vehicle
      ? supabase.from('vehicles').update(payload).eq('id', vehicle.id)
      : supabase.from('vehicles').insert({ ...payload, driver_id: driverId })
    const { error } = await q
    setBusy(false)
    if (error) setError(errMsg(error)); else onSaved()
  }

  return (
    <form onSubmit={save} className="form">
      <div className="row2">
        <label>Make and model<input required value={f.make} onChange={set('make')} placeholder="Toyota Corolla" /></label>
        <label>Colour<input required value={f.colour} onChange={set('colour')} /></label>
      </div>
      <div className="row2">
        <label>Number plate<input required value={f.plate} onChange={set('plate')} placeholder="GR 1234 24" /></label>
        <label>Seats for riders<input required type="number" min="1" max="6" value={f.seats} onChange={set('seats')} /></label>
      </div>
      <div className="row2">
        <label>Licence expires<input required type="date" value={f.licence_expiry} onChange={set('licence_expiry')} /></label>
        <label>Insurance expires<input required type="date" value={f.insurance_expiry} onChange={set('insurance_expiry')} /></label>
      </div>
      {vehicle && <p className="hint">Changing any detail sends your car back for checking.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : vehicle ? 'Save car details' : 'Submit car for checking'}</button>
    </form>
  )
}

function PostRide({ vehicle, corridors, onPosted }) {
  const [corridorId, setCorridorId] = useState(corridors[0]?.id || '')
  const [date, setDate] = useState(today())
  const [time, setTime] = useState('06:30')
  const [seats, setSeats] = useState(Math.min(3, vehicle.seats))
  const [repeat, setRepeat] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const toggle = (n) => setRepeat(repeat.includes(n) ? repeat.filter((x) => x !== n) : [...repeat, n])

  async function post(e) {
    e.preventDefault()
    setError(''); setNotice('')
    const start = new Date(`${date}T${time}:00`)
    const times = []
    if (repeat.length === 0) times.push(start)
    else {
      for (let i = 0; i < 14; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i)
        if (repeat.includes(d.getDay())) times.push(d)
      }
    }
    const future = times.filter((t) => t.getTime() > Date.now())
    if (!future.length) { setError('Pick a departure time in the future.'); return }
    setBusy(true)
    const rows = future.map((t) => ({
      driver_id: vehicle.driver_id, corridor_id: corridorId, depart_at: t.toISOString(), seats_offered: Number(seats)
    }))
    const { error } = await supabase.from('rides').insert(rows)
    setBusy(false)
    if (error) { setError(errMsg(error)); return }
    setNotice(rows.length === 1 ? 'Ride posted.' : `${rows.length} rides posted over the next two weeks.`)
    setRepeat([])
    onPosted()
  }

  return (
    <form onSubmit={post} className="form">
      <label>Corridor
        <select value={corridorId} onChange={(e) => setCorridorId(e.target.value)}>
          {corridors.map((c) => <option key={c.id} value={c.id}>{c.name} ({fmtFare(c.fare_ghs)} a seat)</option>)}
        </select>
      </label>
      <div className="row2">
        <label>Date<input type="date" required min={today()} value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>Leaving at<input type="time" required value={time} onChange={(e) => setTime(e.target.value)} /></label>
      </div>
      <label>Seats to offer
        <select value={seats} onChange={(e) => setSeats(e.target.value)}>
          {Array.from({ length: vehicle.seats }, (_, i) => i + 1).map((n) => <option key={n}>{n}</option>)}
        </select>
      </label>
      <fieldset>
        <legend>Repeat for two weeks on</legend>
        <div className="weekdays">
          {WEEKDAYS.map((w) => (
            <button type="button" key={w.n} aria-pressed={repeat.includes(w.n)}
              className={repeat.includes(w.n) ? 'day on' : 'day'} onClick={() => toggle(w.n)}>{w.label}</button>
          ))}
        </div>
        <p className="hint">Leave all off to post just the one ride.</p>
      </fieldset>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="ok" role="status">{notice}</p>}
      <button className="btn" disabled={busy || !corridorId}>{busy ? 'Posting…' : 'Post ride'}</button>
    </form>
  )
}

function MyRides({ driverId, reloadKey }) {
  const [rides, setRides] = useState(null)
  const [riders, setRiders] = useState({})
  const [error, setError] = useState('')

  async function load() {
    const since = new Date(Date.now() - 2 * 3600e3).toISOString()
    const { data, error } = await supabase.from('rides')
      .select('id,depart_at,seats_offered,corridors(name),bookings(id,status,rider_id,pickup_points(name,seq))')
      .eq('driver_id', driverId).eq('status', 'open').gte('depart_at', since).order('depart_at')
    if (error) { setError(errMsg(error)); return }
    setRides(data || [])
    const ids = [...new Set((data || []).flatMap((r) => r.bookings.filter((b) => ['pending', 'accepted'].includes(b.status)).map((b) => b.rider_id)))]
    if (!ids.length) return
    const { data: ps } = await supabase.from('profiles').select('id,full_name,phone,office').in('id', ids)
    const map = {}; (ps || []).forEach((p) => { map[p.id] = p }); setRiders(map)
  }
  useEffect(() => { load() }, [reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  async function respond(id, accept) {
    setError('')
    const { error } = await supabase.rpc('respond_booking', { p_booking: id, p_accept: accept })
    if (error) setError(errMsg(error))
    load()
  }
  async function cancelRide(id) {
    if (!confirm('Cancel this ride? Anyone booked will see it as cancelled.')) return
    const { error } = await supabase.rpc('cancel_ride', { p_ride: id })
    if (error) setError(errMsg(error))
    load()
  }

  if (rides === null) return <p className="muted">{error || 'Loading…'}</p>
  if (!rides.length) return <p className="muted">You have no upcoming rides.</p>

  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      <ul className="rides">
        {rides.map((r) => {
          const live = r.bookings.filter((b) => ['pending', 'accepted'].includes(b.status))
            .sort((a, b) => a.pickup_points.seq - b.pickup_points.seq)
          return (
            <li key={r.id} className="ride stacked">
              <div className="ride-head">
                <div className="ride-time">{fmtTime(r.depart_at)}<small>{fmtDay(r.depart_at)}</small></div>
                <div className="ride-body">
                  <strong>{r.corridors.name}</strong>
                  <span className="muted">{live.length} of {r.seats_offered} seats booked</span>
                </div>
                <button className="btn small ghost" onClick={() => cancelRide(r.id)}>Cancel ride</button>
              </div>
              {live.length > 0 && (
                <ul className="riders">
                  {live.map((b) => {
                    const p = riders[b.rider_id]
                    return (
                      <li key={b.id}>
                        <div>
                          <strong>{p?.full_name || 'Rider'}</strong>
                          <span>{b.pickup_points.name}</span>
                          {p && <a href={`tel:${p.phone}`}>{p.phone}</a>}
                        </div>
                        {b.status === 'pending' ? (
                          <div className="pair">
                            <button className="btn small" onClick={() => respond(b.id, true)}>Accept</button>
                            <button className="btn small ghost" onClick={() => respond(b.id, false)}>Decline</button>
                          </div>
                        ) : <span className={`badge ${b.status}`}>{statusLabel[b.status]}</span>}
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}

export default function Drive() {
  const { profile, refreshProfile } = useAuth()
  const [vehicle, setVehicle] = useState(undefined)
  const [corridors, setCorridors] = useState([])
  const [editing, setEditing] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  async function loadVehicle() {
    const { data } = await supabase.from('vehicles').select('*').eq('driver_id', profile.id).maybeSingle()
    setVehicle(data || null)
  }
  useEffect(() => {
    loadVehicle()
    supabase.from('corridors').select('id,name,fare_ghs').eq('active', true).order('name')
      .then(({ data }) => setCorridors(data || []))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function becomeDriver() {
    await supabase.from('profiles').update({ is_driver: true }).eq('id', profile.id)
    refreshProfile()
  }

  if (!profile.is_driver) {
    return (
      <main className="page">
        <h1>Drive</h1>
        <p>Driving to work anyway? Offer your empty seats to colleagues on your route and they pay the set fare for each seat.</p>
        <button className="btn" onClick={becomeDriver}>Offer seats in my car</button>
      </main>
    )
  }
  if (vehicle === undefined) return <main className="page"><h1>Drive</h1><p className="muted">Loading…</p></main>

  const expired = vehicle && (vehicle.licence_expiry < today() || vehicle.insurance_expiry < today())

  return (
    <main className="page">
      <h1>Drive</h1>
      <section>
        <h2>Your car</h2>
        {!vehicle || editing ? (
          <VehicleForm vehicle={vehicle} driverId={profile.id} onSaved={() => { setEditing(false); loadVehicle() }} />
        ) : (
          <div className="car">
            <p><strong>{vehicle.colour} {vehicle.make}</strong>, {vehicle.plate}, {vehicle.seats} seats</p>
            {vehicle.verified
              ? <span className="badge accepted">Checked</span>
              : <span className="badge pending">Waiting for the pilot team to check your documents</span>}
            {expired && <p className="error">Your licence or insurance date has passed. Update it to keep posting rides.</p>}
            <button className="btn small ghost" onClick={() => setEditing(true)}>Edit car details</button>
          </div>
        )}
      </section>
      {vehicle && vehicle.verified && !expired && !editing && (
        <section>
          <h2>Post a ride</h2>
          <PostRide vehicle={vehicle} corridors={corridors} onPosted={() => setReloadKey((k) => k + 1)} />
        </section>
      )}
      <section>
        <h2>Your upcoming rides</h2>
        <MyRides driverId={profile.id} reloadKey={reloadKey} />
      </section>
    </main>
  )
}
