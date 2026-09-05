import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import ChatWindow from '../components/ChatWindow'
import { createStudyRoom, joinStudyRoom } from '../lib/conversations'
import { displayName } from '../lib/names'

export default function Messages() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [conversations, setConversations] = useState([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [memberNames, setMemberNames] = useState({})
  const [groupRooms, setGroupRooms] = useState([])
  const [loadingGroupRooms, setLoadingGroupRooms] = useState(true)
  const [tab, setTab] = useState('individual')
  const [showCreate, setShowCreate] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [roomSubject, setRoomSubject] = useState('')
  const [roomError, setRoomError] = useState('')
  const [joiningId, setJoiningId] = useState(null)
  const [creatingRoom, setCreatingRoom] = useState(false)

  const activeId = searchParams.get('c')
  const activeConversation = conversations.find((c) => c.id === activeId)

  async function loadConversations() {
    if (!profile) return
    setLoadingConversations(true)
    const { data: memberships } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', profile.id)

    const ids = (memberships || []).map((m) => m.conversation_id)
    if (ids.length === 0) {
      setConversations([])
      setLoadingConversations(false)
      return
    }

    const { data: convos } = await supabase
      .from('conversations')
      .select('*')
      .in('id', ids)
      .order('created_at', { ascending: false })

    setConversations(convos || [])
    setLoadingConversations(false)

    // Resolve display names for 1:1 chats
    const directIds = (convos || []).filter((c) => !c.is_group).map((c) => c.id)
    if (directIds.length > 0) {
      const { data: members } = await supabase
        .from('conversation_members')
        .select('conversation_id, user_id, profiles(full_name, username, role)')
        .in('conversation_id', directIds)
        .neq('user_id', profile.id)

      const names = {}
      ;(members || []).forEach((m) => {
        names[m.conversation_id] = m.profiles ? displayName(m.profiles, profile.role) : 'Tutor'
      })
      setMemberNames(names)
    }
  }

  // Every group room platform-wide, not just the ones you've joined — the
  // Groups tab shows all of them, with Open/Join depending on membership,
  // instead of splitting "your groups" and "discoverable groups" into two
  // separate places.
  async function loadGroupRooms() {
    setLoadingGroupRooms(true)
    const { data } = await supabase.from('conversations').select('*').eq('is_group', true).order('created_at', { ascending: false })
    setGroupRooms(data || [])
    setLoadingGroupRooms(false)
  }

  useEffect(() => {
    loadConversations()
    loadGroupRooms()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  async function handleCreateRoom(e) {
    e.preventDefault()
    if (!roomName.trim()) return
    setRoomError('')
    setCreatingRoom(true)
    try {
      const room = await createStudyRoom({ name: roomName.trim(), subject: roomSubject.trim(), myId: profile.id })
      setShowCreate(false)
      setRoomName('')
      setRoomSubject('')
      await loadConversations()
      await loadGroupRooms()
      setSearchParams({ c: room.id })
      setTab('groups')
    } catch (err) {
      setRoomError(err.message)
    } finally {
      setCreatingRoom(false)
    }
  }

  async function handleJoin(room) {
    if (joiningId) return
    setRoomError('')
    setJoiningId(room.id)
    try {
      await joinStudyRoom({ conversationId: room.id, myId: profile.id })
      await loadConversations()
      setSearchParams({ c: room.id })
      setTab('groups')
    } catch (err) {
      setRoomError(err.message)
    } finally {
      setJoiningId(null)
    }
  }

  const individualConversations = conversations.filter((c) => !c.is_group)
  const myRoomIds = new Set(conversations.map((c) => c.id))

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-display text-4xl font-semibold text-ink">Messages</h1>

      <div className="mt-8 grid gap-6 md:grid-cols-[300px_1fr]">
        <aside className="card flex flex-col">
          <div className="flex border-b border-line">
            <TabButton active={tab === 'individual'} onClick={() => setTab('individual')}>
              Individual
            </TabButton>
            <TabButton active={tab === 'groups'} onClick={() => setTab('groups')}>
              Groups
            </TabButton>
          </div>

          {tab === 'individual' ? (
            <div className="flex flex-1 flex-col overflow-y-auto p-2">
              {loadingConversations ? (
                <p className="p-4 text-sm text-muted">Loading conversations…</p>
              ) : (
                individualConversations.length === 0 && (
                  <p className="p-4 text-sm text-muted">No conversations yet. Message a tutor or a peer.</p>
                )
              )}
              {individualConversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSearchParams({ c: c.id })}
                  className={`rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                    activeId === c.id ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-teal-soft'
                  }`}
                >
                  <span className="block font-medium">{memberNames[c.id] || 'Conversation'}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-y-auto p-2">
              {roomError && <p className="p-2 text-xs text-danger">{roomError}</p>}
              {loadingGroupRooms ? (
                <p className="p-4 text-sm text-muted">Loading rooms…</p>
              ) : (
                groupRooms.length === 0 && (
                  <p className="p-4 text-sm text-muted">No study rooms yet — start one.</p>
                )
              )}
              {groupRooms.map((r) => {
                const joined = myRoomIds.has(r.id)
                return (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm ${
                      joined && activeId === r.id ? 'bg-ink text-paper' : ''
                    }`}
                  >
                    <button
                      onClick={() => joined && setSearchParams({ c: r.id })}
                      disabled={!joined}
                      className="min-w-0 flex-1 text-left disabled:cursor-default"
                    >
                      <span className={`block truncate font-medium ${joined && activeId === r.id ? '' : 'text-ink-soft'}`}>
                        🧑‍🤝‍🧑 {r.name}
                      </span>
                      {r.subject && (
                        <span className={`block truncate text-xs ${joined && activeId === r.id ? 'text-paper/70' : 'text-muted'}`}>
                          {r.subject}
                        </span>
                      )}
                    </button>
                    {!joined && (
                      <button onClick={() => handleJoin(r)} disabled={joiningId === r.id} className="btn btn-outline shrink-0 px-3 py-1 text-xs">
                        {joiningId === r.id ? 'Joining…' : 'Join'}
                      </button>
                    )}
                  </div>
                )
              })}
              <button
                onClick={() => {
                  setRoomError('')
                  setShowCreate(true)
                }}
                className="mt-2 rounded-xl border border-dashed border-line px-3 py-2.5 text-left text-sm font-medium text-teal hover:bg-teal-soft"
              >
                + New study room
              </button>
            </div>
          )}
        </aside>

        <div className="card flex min-h-[520px] flex-col">
          <ChatWindow
            conversation={activeConversation}
            myId={profile?.id}
            myName={profile?.full_name}
            myRole={profile?.role}
            memberNames={memberNames}
          />
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6">
          <div className="card w-full max-w-sm p-6">
            <h2 className="font-display text-xl font-medium text-ink">New study room</h2>
            <form onSubmit={handleCreateRoom} className="mt-4 flex flex-col gap-3">
              <input
                required
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Room name, e.g. Calc II crunch"
                className="input"
              />
              <input
                value={roomSubject}
                onChange={(e) => setRoomSubject(e.target.value)}
                placeholder="Subject (optional)"
                className="input"
              />
              {roomError && <p className="text-sm text-danger">{roomError}</p>}

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-full px-4 py-2 text-sm font-medium text-muted"
                >
                  Cancel
                </button>
                <button type="submit" disabled={creatingRoom} className="btn btn-primary px-5 py-2 text-sm">
                  {creatingRoom ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
        active ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink-soft'
      }`}
    >
      {children}
    </button>
  )
}
