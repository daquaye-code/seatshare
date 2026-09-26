import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { dateStr, errMsg, fmtDay, fmtFare, fmtTime, statusLabel } from '../lib/format'
import RouteStrip from '../components/RouteStrip'

function nextDays(n) {
  const out = []
  const d = new Date()
  for (let i = 0; i < n; i++) {
    const x = new Date(d); x.setDate(d.getDate() + i)
    out.push({ value: dateStr(x), label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : fmtDay(x) })
  }
  return out
}

export default function FindRide() {
  const [corridors, setCorridors] = useState([])
  const [corridorId, setCorridorId] = useState(() => localStorage.getItem('corridor') || '')
  const [day, setDay] = useState(dateStr(new Date()))
  const [pickupId, setPickupId] = useState('')
  const [rides, setRides] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyRide, setBusyRide] = useState(null)
  const days = useMemo(() => nextDays(7), [])

  useEffect(() => {
    supabase.from('corridors')
      .select('id,name,destination,fare_ghs,pickup_points(id,name,seq)')
      .eq('active', true).order('name')
      .then(({ data, error }) => {
        if (error) { setError(errMsg(error)); return }
        const list = (data || []).map((c) => ({
          ...c, pickup_points: [...c.pickup_points].sort((a, b) => a.seq - b.seq)
        }))
        setCorridors(list)
        if (!list.find((c) => c.id === corridorId) && list[0]) setCorridorId(list[0].id)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const corridor = corridors.find((c) => c.id === corridorId)

  useEffect(() => {
    if (!corridor) return
    localStorage.setItem('corridor', corridor.id)
    if (!corridor.pickup_points.find((p) => p.id === pickupId)) {
      setPickupId(corridor.pickup_points[0]?.id || '')
    }
  }, [corridor]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadRides() {
    if (!corridorId) return
    setRides(null)
    const { data, error } = await supabase.rpc('list_rides', { p_corridor: corridorId, p_day: day })
    if (error) setError(errMsg(error))
    else setRides(data)
  }
  useEffect(() => { loadRides() }, [corridorId, day]) // eslint-disable-line react-hooks/exhaustive-deps

  async function book(rideId) {
    setBusyRide(rideId); setError(''); setNotice('')
    const { error } = await supabase.rpc('book_seat', { p_ride: rideId, p_pickup: pickupId })
    setBusyRide(null)
    if (error) setError(errMsg(error))
    else setNotice('Seat requested. The driver will confirm it.')
    loadRides()
  }

  if (!corridors.length) {
    return <main className="page"><h1>Find a ride</h1><p>{error || 'Loading corridors…'}</p></main>
  }

  return (
    <main className="page">
      <label className="corridor-pick">
        <span className="sr">Corridor</span>
        <select value={corridorId} onChange={(e) => setCorridorId(e.target.value)}>
          {corridors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      {corridor && (
        <>
          <p className="fare-line">{fmtFare(corridor.fare_ghs)} per seat. Tap where you will be picked up.</p>
          <RouteStrip points={corridor.pickup_points} destination={corridor.destination}
            selectedId={pickupId} onSelect={setPickupId} />
        </>
      )}

      <div className="days" role="tablist" aria-label="Day">
        {days.map((d) => (
          <button key={d.value} role="tab" aria-selected={day === d.value}
            className={day === d.value ? 'day on' : 'day'} onClick={() => setDay(d.value)}>
            {d.label}
          </button>
        ))}
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="ok" role="status">{notice} <Link to="/seats">See my seats</Link></p>}

      {rides === null ? <p className="muted">Loading rides…</p> : rides.length === 0 ? (
        <div className="empty">
          <p>No rides posted on this corridor for that day yet.</p>
          <p>Driving this way? <Link to="/drive">Offer your empty seats</Link>.</p>
        </div>
      ) : (
        <ul className="rides">
          {rides.map((r) => (
            <li key={r.ride_id} className="ride">
              <div className="ride-time">{fmtTime(r.depart_at)}</div>
              <div className="ride-body">
                <strong>{r.driver_name}</strong>
                <span>{r.vehicle}</span>
                <span className="muted">{r.seats_left} {r.seats_left === 1 ? 'seat' : 'seats'} left</span>
              </div>
              <div className="ride-act">
                {r.my_status ? (
                  <span className={`badge ${r.my_status}`}>{statusLabel[r.my_status]}</span>
                ) : (
                  <button className="btn small" disabled={r.seats_left < 1 || !pickupId || busyRide === r.ride_id}
                    onClick={() => book(r.ride_id)}>
                    {r.seats_left < 1 ? 'Full' : busyRide === r.ride_id ? 'Booking…' : 'Book seat'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
