import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { getOrCreateDirectConversation } from '../lib/conversations'
import CoverArt from '../components/CoverArt'
import { initials } from '../lib/format'
import { displayName } from '../lib/names'

export default function Peers() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [peers, setPeers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [startingId, setStartingId] = useState(null)
  const [startError, setStartError] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    async function load() {
      setLoading(true)
      let query = supabase.from('profiles').select('*').eq('role', 'student').neq('id', profile.id)
      if (debouncedSearch.trim()) {
        query = query.textSearch('search_vector', debouncedSearch.trim(), { type: 'websearch', config: 'english' })
      }
      const { data } = await query
      setPeers(data || [])
      setLoading(false)
    }
    if (profile?.id) load()
  }, [profile?.id, debouncedSearch])

  async function messagePeer(peer) {
    setStartingId(peer.id)
    setStartError('')
    try {
      const convo = await getOrCreateDirectConversation(profile.id, peer.id)
      navigate(`/messages?c=${convo.id}`)
    } catch (err) {
      setStartError(`Couldn't start a chat with ${displayName(peer, profile.role)}: ${err.message}`)
    } finally {
      setStartingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="font-display text-4xl font-semibold text-ink">Peers</h1>
      <p className="mt-2 max-w-lg text-muted">
        Find other students to study with directly — separate from tutor chats and group study rooms.
      </p>

      <input
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Search by name, bio, or subject"
        className="input mt-6 w-full max-w-lg"
      />

      {startError && <p className="mt-4 text-sm text-danger">{startError}</p>}

      {loading ? (
        <p className="mt-10 text-sm text-muted">Loading peers…</p>
      ) : peers.length === 0 ? (
        <div className="mt-10 card p-8 text-center">
          <p className="text-ink-soft">No other students match yet.</p>
          <p className="mt-1 text-sm text-muted">Try a different search, or check back once more students join.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {peers.map((peer) => {
            const name = displayName(peer, profile.role)
            return (
            <div key={peer.id} className="card flex flex-col overflow-hidden">
              <div className="relative h-16">
                <CoverArt seed={peer.subjects?.[0] || name} className="h-full w-full" />
                {peer.avatar_url ? (
                  <img
                    src={peer.avatar_url}
                    alt={name}
                    className="absolute -bottom-5 left-4 h-10 w-10 rounded-full border-4 border-paper-raised object-cover"
                  />
                ) : (
                  <div className="absolute -bottom-5 left-4 flex h-10 w-10 items-center justify-center rounded-full border-4 border-paper-raised bg-ink text-xs font-semibold text-paper">
                    {initials(name)}
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col p-4 pt-7">
                <p className="text-sm font-medium text-ink">{name}</p>
                {peer.bio && <p className="mt-1.5 line-clamp-2 text-xs text-muted">{peer.bio}</p>}
                {(peer.subjects || []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {peer.subjects.slice(0, 3).map((s) => (
                      <span key={s} className="rounded-full bg-teal-soft px-2 py-0.5 text-[11px] font-medium text-ink">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => messagePeer(peer)}
                  disabled={startingId === peer.id}
                  className="btn btn-primary mt-4 px-4 py-2 text-sm"
                >
                  {startingId === peer.id ? 'Opening chat…' : 'Message'}
                </button>
              </div>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
