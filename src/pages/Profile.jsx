import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import ProfileForm from '../components/ProfileForm'

export default function Profile() {
  const { profile, refreshProfile, signOut } = useAuth()
  const [saved, setSaved] = useState(false)

  async function save(f) {
    setSaved(false)
    const { error } = await supabase.from('profiles').update(f).eq('id', profile.id)
    if (error) throw error
    await refreshProfile()
    setSaved(true)
  }

  return (
    <main className="page">
      <h1>Profile</h1>
      <p className="lede">{profile.email}</p>
      <ProfileForm initial={profile} submitLabel="Save changes" onSubmit={save} />
      {saved && <p className="ok" role="status">Changes saved.</p>}
      <button className="btn ghost" onClick={signOut}>Sign out</button>
    </main>
  )
}
