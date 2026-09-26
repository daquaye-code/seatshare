import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { errMsg, fmtDay, fmtFare, fmtTime, statusLabel } from '../lib/format'

export default function MyBookings() {
  const { profile } = useAuth()
  const [items, setItems] = useState(null)
  const [drivers, setDrivers] = useState({})
  const [error, setError] = useState('')

  async function load() {
    const { data, error } = await supabase.from('bookings')
      .select('id,status,fare_ghs,pickup_points(name),rides(id,depart_at,status,driver_id,corridors(name,destination))')
      .eq('rider_id', profile.id)
    if (error) { setError(errMsg(error)); return }
    const list = (data || []).filter((b) => b.rides)
      .sort((a, b) => new Date(a.rides.depart_at) - new Date(b.rides.depart_at))
    setItems(list)

    const ids = [...new Set(list.filter((b) => ['pending', 'accepted'].includes(b.status)).map((b) => b.rides.driver_id))]
    if (!ids.length) return
    const [{ data: ps }, { data: vs }] = await Promise.all([
      supabase.from('profiles').select('id,full_name,phone').in('id', ids),
      supabase.from('vehicles').select('driver_id,make,colour,plate').in('driver_id', ids)
    ])
    const map = {}
    ;(ps || []).forEach((p) => { map[p.id] = { ...p } })
    ;(vs || []).forEach((v) => { map[v.driver_id] = { ...(map[v.driver_id] || {}), vehicle: v } })
    setDrivers(map)
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function cancel(id) {
    if (!confirm('Cancel this seat?')) return
    setError('')
    const { error } = await supabase.rpc('cancel_booking', { p_booking: id })
    if (error) setError(errMsg(error))
    load()
  }

  if (items === null) return <main className="page"><h1>My seats</h1><p className="muted">{error || 'Loading…'}</p></main>

  const now = Date.now()
  const upcoming = items.filter((b) => new Date(b.rides.depart_at).getTime() > now - 3600e3 && ['pending', 'accepted'].includes(b.status))
  const past = items.filter((b) => !upcoming.includes(b)).reverse()

  const row = (b, live) => {
    const d = drivers[b.rides.driver_id]
    return (
      <li key={b.id} className="ride">
        <div className="ride-time">{fmtTime(b.rides.depart_at)}<small>{fmtDay(b.rides.depart_at)}</small></div>
        <div className="ride-body">
          <strong>{b.rides.corridors.name}</strong>
          <span>Pickup at {b.pickup_points.name}</span>
          <span className="muted">{fmtFare(b.fare_ghs)}</span>
          {live && b.status === 'accepted' && d && (
            <span className="contact">
              {d.full_name}, <a href={`tel:${d.phone}`}>{d.phone}</a>
              {d.vehicle && <> in a {d.vehicle.colour} {d.vehicle.make}, {d.vehicle.plate}</>}
            </span>
          )}
          {b.rides.status === 'cancelled' && <span className="error">The driver cancelled this ride.</span>}
        </div>
        <div className="ride-act">
          <span className={`badge ${b.status}`}>{statusLabel[b.status]}</span>
          {live && <button className="btn small ghost" onClick={() => cancel(b.id)}>Cancel</button>}
        </div>
      </li>
    )
  }

  return (
    <main className="page">
      <h1>My seats</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {upcoming.length === 0 ? (
        <div className="empty"><p>No upcoming seats.</p><p><Link to="/">Find a ride</Link></p></div>
      ) : <ul className="rides">{upcoming.map((b) => row(b, true))}</ul>}
      {past.length > 0 && (<><h2>Earlier</h2><ul className="rides past">{past.map((b) => row(b, false))}</ul></>)}
    </main>
  )
}
