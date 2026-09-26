import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import ProfileForm from '../components/ProfileForm'

export default function Onboarding() {
  const { session, refreshProfile, signOut } = useAuth()

  async function save(f) {
    const { error } = await supabase.from('profiles').insert({
      ...f,
      id: session.user.id,
      email: session.user.email,
      is_rider: true,
      accepted_terms_at: new Date().toISOString()
    })
    if (error) {
      if (error.code === '23505') throw new Error('That staff ID is already registered. Contact the pilot team if this is wrong.')
      throw error
    }
    await refreshProfile()
  }

  return (
    <main className="page narrow">
      <h1>Set up your profile</h1>
      <p className="lede">The pilot team checks your staff ID before approving you. Drivers and riders see each other's name and phone number once a seat is booked.</p>
      <ProfileForm submitLabel="Join the pilot" onSubmit={save} showTerms />
      <button className="btn ghost" onClick={signOut}>Sign out</button>
    </main>
  )
}
