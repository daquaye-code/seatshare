import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Nav from './components/Nav'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import FindRide from './pages/FindRide'
import MyBookings from './pages/MyBookings'
import Drive from './pages/Drive'
import Profile from './pages/Profile'
import Admin from './pages/Admin'

export default function App() {
  const { session, profile, loading, signOut, refreshProfile } = useAuth()

  if (loading) return <div className="splash">SeatShare</div>
  if (!session) return <Login />
  if (!profile) return <Onboarding />
  if (profile.status === 'pending') {
    return (
      <main className="page narrow">
        <h1>Waiting for approval</h1>
        <p>Thanks, {profile.full_name.split(' ')[0]}. The pilot team will check your staff ID ({profile.staff_id}) and approve your account, usually within a working day.</p>
        <button className="btn" onClick={refreshProfile}>Check again</button>
        <button className="btn ghost" onClick={signOut}>Sign out</button>
      </main>
    )
  }
  if (profile.status === 'suspended') {
    return (
      <main className="page narrow">
        <h1>Account not active</h1>
        <p>Your account is not active in this pilot. Contact the pilot team to find out why.</p>
        <button className="btn ghost" onClick={signOut}>Sign out</button>
      </main>
    )
  }

  return (
    <div className="shell">
      <Routes>
        <Route path="/" element={<FindRide />} />
        <Route path="/seats" element={<MyBookings />} />
        <Route path="/drive" element={<Drive />} />
        <Route path="/profile" element={<Profile />} />
        {profile.role === 'admin' && <Route path="/admin" element={<Admin />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Nav isAdmin={profile.role === 'admin'} />
    </div>
  )
}
