import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function ReportsTab({ profile }) {
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [copiedToken, setCopiedToken] = useState(null)

  async function load() {
    const { data } = await supabase
      .from('progress_share_links')
      .select('*')
      .eq('student_id', profile.id)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
    setLinks(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id])

  async function createLink() {
    const { error } = await supabase.from('progress_share_links').insert({ student_id: profile.id })
    if (!error) await load()
  }

  async function revokeLink(token) {
    if (!confirm('Revoke this link? Anyone still holding it will lose access immediately.')) return
    await supabase.from('progress_share_links').update({ revoked_at: new Date().toISOString() }).eq('token', token)
    await load()
  }

  async function copyLink(token) {
    const url = `${window.location.origin}/report/${token}`
    await navigator.clipboard.writeText(url)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-ink">Progress reports</h1>
      <p className="mt-2 text-muted">
        Generate a read-only link a parent or guardian can open without an account — it shows your quiz performance
        by subject, nothing else (no messages, no contact info, no payments).
      </p>

      <button onClick={createLink} className="btn btn-primary mt-6 px-5 py-2.5 text-sm">
        + Create a new link
      </button>

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : links.length === 0 ? (
        <p className="card mt-6 p-6 text-center text-sm text-muted">No active report links yet.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {links.map((l) => (
            <div key={l.token} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{window.location.origin}/report/{l.token}</p>
                <p className="text-xs text-muted">Created {new Date(l.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => copyLink(l.token)} className="btn btn-outline px-3 py-1.5 text-xs">
                  {copiedToken === l.token ? 'Copied!' : 'Copy'}
                </button>
                <button onClick={() => revokeLink(l.token)} className="btn btn-danger-outline px-3 py-1.5 text-xs">
                  Revoke
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
