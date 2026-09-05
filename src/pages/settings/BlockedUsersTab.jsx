import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function BlockedUsersTab({ myId }) {
  const [blocked, setBlocked] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase
      .from('blocked_users')
      .select('blocked_id, blocked:profiles!blocked_users_blocked_id_fkey(full_name, avatar_url)')
      .eq('blocker_id', myId)
    setBlocked(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId])

  async function unblock(blockedId) {
    await supabase.from('blocked_users').delete().eq('blocker_id', myId).eq('blocked_id', blockedId)
    await load()
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-ink">Blocked users</h1>
      <p className="mt-2 text-muted">People you've blocked can't message you until you unblock them.</p>

      <div className="mt-6 flex flex-col gap-2">
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : blocked.length === 0 ? (
          <p className="text-sm text-muted">You haven't blocked anyone.</p>
        ) : (
          blocked.map((b) => (
            <div key={b.blocked_id} className="flex items-center justify-between rounded-xl border border-line px-4 py-2.5">
              <div className="flex items-center gap-2">
                {b.blocked?.avatar_url ? (
                  <img src={b.blocked.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs text-paper">
                    {(b.blocked?.full_name || '?')[0]}
                  </span>
                )}
                <span className="text-sm text-ink-soft">{b.blocked?.full_name || 'Unknown user'}</span>
              </div>
              <button onClick={() => unblock(b.blocked_id)} className="text-sm font-medium text-teal hover:underline">
                Unblock
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
