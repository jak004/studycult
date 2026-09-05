import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function NotificationBell({ userId }) {
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const panelRef = useRef(null)

  useEffect(() => {
    if (!userId) return
    let active = true

    async function load() {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)
      if (active) setNotifications(data || [])
    }
    load()

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev])
        }
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [userId])

  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  async function markRead(id) {
    setNotifications((prev) => prev.map((x) => (x.id === id ? { ...x, read: true } : x)))
    await supabase.from('notifications').update({ read: true }).eq('id', id)
  }

  async function markAllRead() {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    if (unreadIds.length === 0) return
    setNotifications((prev) => prev.map((x) => ({ ...x, read: true })))
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds)
  }

  async function openNotification(n) {
    setOpen(false)
    if (!n.read) await markRead(n.id)
    if (n.link) navigate(n.link)
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full border border-line bg-paper-raised p-2 text-ink-soft transition-colors hover:border-ink/30"
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-paper">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-2xl border border-line bg-paper-raised shadow-[0_20px_50px_-20px_rgba(22,35,61,0.35)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-medium text-ink">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs font-medium text-teal hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-sm text-muted">Nothing yet.</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex w-full items-start gap-2 border-b border-line px-4 py-3 text-sm last:border-0 hover:bg-teal-soft ${
                    n.read ? 'text-muted' : 'text-ink'
                  }`}
                >
                  <button
                    onClick={() => !n.read && markRead(n.id)}
                    title={n.read ? 'Read' : 'Mark as read'}
                    aria-label={n.read ? 'Read' : 'Mark as read'}
                    className="mt-1.5 shrink-0"
                  >
                    <span className={`block h-2 w-2 rounded-full ${n.read ? 'bg-transparent' : 'bg-teal'}`} />
                  </button>
                  <button onClick={() => openNotification(n)} className="min-w-0 flex-1 text-left">
                    <p className="font-medium">{n.title}</p>
                    {n.body && <p className="mt-0.5 truncate text-xs text-muted">{n.body}</p>}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
