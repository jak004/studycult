import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function CompleteProfile() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [role, setRole] = useState('student')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    await supabase.from('profiles').update({ role }).eq('id', profile.id)
    await refreshProfile()
    setBusy(false)
    navigate('/dashboard')
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-ink">One more thing</h1>
      <p className="mt-2 text-sm text-muted">
        Welcome, {profile?.full_name}. Are you here to learn or to teach?
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          <RoleOption current={role} value="student" onSelect={setRole} label="I'm a student" hint="Get help, join rooms" />
          <RoleOption current={role} value="tutor" onSelect={setRole} label="I'm a tutor" hint="Teach, build quizzes" />
        </div>
        <button type="submit" disabled={busy} className="btn btn-primary px-6 py-3 text-sm">
          {busy ? 'Saving…' : 'Continue'}
        </button>
      </form>
    </div>
  )
}

function RoleOption({ current, value, onSelect, label, hint }) {
  const active = current === value
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`rounded-xl border px-4 py-3 text-left transition-colors ${
        active ? 'border-teal bg-teal-soft' : 'border-line bg-paper-raised hover:border-ink/30'
      }`}
    >
      <span className="block text-sm font-semibold text-ink">{label}</span>
      <span className="block text-xs text-muted">{hint}</span>
    </button>
  )
}
