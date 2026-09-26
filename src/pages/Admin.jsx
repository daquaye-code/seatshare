import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { errMsg, fmtFare } from '../lib/format'

function Drivers() {
  const { profile } = useAuth()
  const [list, setList] = useState(null)
  const [error, setError] = useState('')
  async function load() {
    const { data, error } = await supabase.from('vehicles')
      .select('*, driver:profiles!vehicles_driver_id_fkey(full_name,staff_id,phone,office)')
      .order('verified').order('created_at')
    if (error) setError(errMsg(error)); else setList(data)
  }
  useEffect(() => { load() }, [])
  async function setVerified(v, ok) {
    const { error } = await supabase.from('vehicles').update(
      ok ? { verified: true, verified_at: new Date().toISOString(), verified_by: profile.id }
         : { verified: false, verified_at: null, verified_by: null }
    ).eq('id', v.id)
    if (error) setError(errMsg(error)); load()
  }
  if (!list) return <p className="muted">{error || 'Loading…'}</p>
  if (!list.length) return <p className="muted">No drivers have submitted a car yet.</p>
  return (
    <>
    {error && <p className="error">{error}</p>}
    <ul className="rides">
      {list.map((v) => (
        <li key={v.id} className="ride">
          <div className="ride-body">
            <strong>{v.driver.full_name}</strong>
            <span>Staff ID {v.driver.staff_id}, {v.driver.office}, <a href={`tel:${v.driver.phone}`}>{v.driver.phone}</a></span>
            <span>{v.colour} {v.make}, {v.plate}, {v.seats} seats</span>
            <span className="muted">Licence to {v.licence_expiry}. Insurance to {v.insurance_expiry}.</span>
          </div>
          <div className="ride-act">
            {v.verified
              ? <button className="btn small ghost" onClick={() => setVerified(v, false)}>Remove check</button>
              : <button className="btn small" onClick={() => setVerified(v, true)}>Mark checked</button>}
          </div>
        </li>
      ))}
    </ul>
    </>
  )
}

function Corridors() {
  const [list, setList] = useState(null)
  const [error, setError] = useState('')
  const [nc, setNc] = useState({ name: '', destination: 'Head Office', fare_ghs: '' })
  const [newStop, setNewStop] = useState({})

  async function load() {
    const { data, error } = await supabase.from('corridors')
      .select('*, pickup_points(id,name,seq)').order('name')
    if (error) setError(errMsg(error))
    else setList(data.map((c) => ({ ...c, pickup_points: [...c.pickup_points].sort((a, b) => a.seq - b.seq) })))
  }
  useEffect(() => { load() }, [])
  const run = async (q) => { setError(''); const { error } = await q; if (error) setError(errMsg(error)); load() }

  async function addCorridor(e) {
    e.preventDefault()
    await run(supabase.from('corridors').insert({ ...nc, fare_ghs: Number(nc.fare_ghs) }))
    setNc({ name: '', destination: 'Head Office', fare_ghs: '' })
  }
  async function addStop(c) {
    const name = (newStop[c.id] || '').trim()
    if (!name) return
    const seq = (c.pickup_points.at(-1)?.seq || 0) + 1
    await run(supabase.from('pickup_points').insert({ corridor_id: c.id, name, seq }))
    setNewStop({ ...newStop, [c.id]: '' })
  }
  async function move(c, i, dir) {
    const a = c.pickup_points[i], b = c.pickup_points[i + dir]
    if (!b) return
    setError('')
    const r1 = await supabase.from('pickup_points').update({ seq: b.seq }).eq('id', a.id)
    const r2 = await supabase.from('pickup_points').update({ seq: a.seq }).eq('id', b.id)
    if (r1.error || r2.error) setError(errMsg(r1.error || r2.error))
    load()
  }
  function removeStop(p) {
    if (!confirm(`Remove ${p.name}?`)) return
    run(supabase.from('pickup_points').delete().eq('id', p.id))
  }
  function editFare(c) {
    const v = prompt(`New fare per seat for ${c.name} (GH₵)`, c.fare_ghs)
    if (v === null || isNaN(Number(v))) return
    run(supabase.from('corridors').update({ fare_ghs: Number(v) }).eq('id', c.id))
  }

  if (!list) return <p className="muted">{error || 'Loading…'}</p>
  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      {list.map((c) => (
        <section key={c.id} className={c.active ? 'corridor' : 'corridor off'}>
          <div className="corridor-head">
            <div><strong>{c.name}</strong><span className="muted">To {c.destination}, {fmtFare(c.fare_ghs)} a seat{!c.active && ', hidden'}</span></div>
            <div className="pair">
              <button className="btn small ghost" onClick={() => editFare(c)}>Change fare</button>
              <button className="btn small ghost" onClick={() => run(supabase.from('corridors').update({ active: !c.active }).eq('id', c.id))}>
                {c.active ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <ol className="stops-edit">
            {c.pickup_points.map((p, i) => (
              <li key={p.id}>
                <span>{p.name}</span>
                <div className="pair">
                  <button className="icon" aria-label={`Move ${p.name} up`} disabled={i === 0} onClick={() => move(c, i, -1)}>↑</button>
                  <button className="icon" aria-label={`Move ${p.name} down`} disabled={i === c.pickup_points.length - 1} onClick={() => move(c, i, 1)}>↓</button>
                  <button className="icon" aria-label={`Remove ${p.name}`} onClick={() => removeStop(p)}>✕</button>
                </div>
              </li>
            ))}
          </ol>
          <div className="inline-add">
            <input placeholder="Add a pickup point" value={newStop[c.id] || ''}
              onChange={(e) => setNewStop({ ...newStop, [c.id]: e.target.value })} />
            <button className="btn small" onClick={() => addStop(c)}>Add</button>
          </div>
        </section>
      ))}
      <form onSubmit={addCorridor} className="form">
        <h3>New corridor</h3>
        <label>Name<input required value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} placeholder="Kasoa to Head Office" /></label>
        <div className="row2">
          <label>Destination<input required value={nc.destination} onChange={(e) => setNc({ ...nc, destination: e.target.value })} /></label>
          <label>Fare per seat (GH₵)<input required type="number" min="0" step="0.5" value={nc.fare_ghs} onChange={(e) => setNc({ ...nc, fare_ghs: e.target.value })} /></label>
        </div>
        <button className="btn">Add corridor</button>
      </form>
    </>
  )
}

function Users() {
  const { profile: me } = useAuth()
  const [list, setList] = useState(null)
  const [q, setQ] = useState('')
  const [error, setError] = useState('')
  async function load() {
    const { data, error } = await supabase.from('profiles').select('*').order('full_name')
    if (error) setError(errMsg(error)); else setList(data)
  }
  useEffect(() => { load() }, [])
  async function setStatus(u, next, verb) {
    if (!confirm(`${verb} ${u.full_name}?`)) return
    const { error } = await supabase.from('profiles').update({ status: next }).eq('id', u.id)
    if (error) setError(errMsg(error)); load()
  }
  if (!list) return <p className="muted">{error || 'Loading…'}</p>
  const order = { pending: 0, active: 1, suspended: 2 }
  const shown = list
    .filter((u) => `${u.full_name} ${u.staff_id} ${u.email}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => order[a.status] - order[b.status])
  const waiting = list.filter((u) => u.status === 'pending').length
  return (
    <>
      {waiting > 0 && <p className="ok">{waiting} waiting for approval. Check each staff ID against the staff directory before approving.</p>}
      <input className="search" placeholder="Search by name, staff ID or email" value={q} onChange={(e) => setQ(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <ul className="rides">
        {shown.map((u) => (
          <li key={u.id} className="ride">
            <div className="ride-body">
              <strong>{u.full_name}{u.role === 'admin' && ' (admin)'}</strong>
              <span>{u.staff_id}, {u.office}, {u.is_driver ? 'driver and rider' : 'rider'}</span>
              <span className="muted">{u.email}, {u.phone}</span>
            </div>
            <div className="ride-act">
              {u.status === 'pending' && <span className="badge pending">Waiting</span>}
              {u.status === 'suspended' && <span className="badge declined">Not active</span>}
              {u.id !== me.id && u.status === 'pending' && (
                <div className="pair">
                  <button className="btn small" onClick={() => setStatus(u, 'active', 'Approve')}>Approve</button>
                  <button className="btn small ghost" onClick={() => setStatus(u, 'suspended', 'Reject')}>Reject</button>
                </div>
              )}
              {u.id !== me.id && u.status === 'active' && (
                <button className="btn small ghost" onClick={() => setStatus(u, 'suspended', 'Pause')}>Pause</button>
              )}
              {u.id !== me.id && u.status === 'suspended' && (
                <button className="btn small ghost" onClick={() => setStatus(u, 'active', 'Restore')}>Restore</button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

function Activity() {
  const [s, setS] = useState(null)
  useEffect(() => {
    const since = new Date(Date.now() - 7 * 864e5).toISOString()
    const count = (q) => q.then((r) => r.count ?? 0)
    Promise.all([
      count(supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'active')),
      count(supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
      count(supabase.from('vehicles').select('*', { count: 'exact', head: true }).eq('verified', true)),
      count(supabase.from('rides').select('*', { count: 'exact', head: true }).eq('status', 'open').gte('depart_at', since).lte('depart_at', new Date().toISOString())),
      count(supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'accepted').gte('created_at', since))
    ]).then(([users, pending, drivers, rides, seats]) => setS({ users, pending, drivers, rides, seats }))
  }, [])
  if (!s) return <p className="muted">Loading…</p>
  return (
    <dl className="stats">
      <div><dt>Approved staff</dt><dd>{s.users}</dd></div>
      <div><dt>Waiting for approval</dt><dd>{s.pending}</dd></div>
      <div><dt>Checked drivers</dt><dd>{s.drivers}</dd></div>
      <div><dt>Rides run in the last 7 days</dt><dd>{s.rides}</dd></div>
      <div><dt>Seats confirmed in the last 7 days</dt><dd>{s.seats}</dd></div>
    </dl>
  )
}

const TABS = { users: ['People', Users], drivers: ['Drivers', Drivers], corridors: ['Corridors', Corridors], activity: ['Activity', Activity] }

export default function Admin() {
  const [tab, setTab] = useState('users')
  const Current = TABS[tab][1]
  return (
    <main className="page">
      <h1>Admin</h1>
      <div className="days" role="tablist">
        {Object.entries(TABS).map(([k, [label]]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'day on' : 'day'} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      <Current />
    </main>
  )
}
