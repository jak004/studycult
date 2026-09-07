import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthContext'
import { startCall, acceptCall, declineCall, markMissed, endCall } from '../lib/calls'

const CallContext = createContext(null)

const RING_TIMEOUT_MS = 30_000
const RESOLVED_CLEAR_MS = 2_500

// Global calling state machine, mounted once at the app root (see main.jsx)
// so an incoming call reaches the receiver on whatever page they're on, not
// just inside the chat that call belongs to. Everything routes through one
// Realtime channel subscribed to the `calls` table — postgres_changes, same
// mechanism ChatWindow already uses for messages, just filtered to rows
// where the current user is caller or receiver instead of a conversation id.
export function CallProvider({ children }) {
  const { profile } = useAuth()
  const myId = profile?.id

  // At most one of each kind at a time — this app makes no attempt to queue
  // a second incoming call while one is already ringing/active (fine for the
  // 1:1 scope here).
  const [incomingCall, setIncomingCall] = useState(null)
  const [outgoingCall, setOutgoingCall] = useState(null)
  const [activeCall, setActiveCall] = useState(null)

  const ringTimeoutRef = useRef(null)
  const resolvedClearRef = useRef(null)

  useEffect(() => {
    if (!myId) return
    let active = true

    function applyUpdate(row) {
      if (!active) return

      setIncomingCall((cur) => (cur && cur.id === row.id && row.status !== 'ringing' ? null : cur))

      setOutgoingCall((cur) => {
        if (!cur || cur.id !== row.id) return cur
        if (row.status === 'accepted') {
          clearTimeout(ringTimeoutRef.current)
          setActiveCall({ id: row.id, roomUrl: row.room_url, otherName: cur.receiverName })
          return null
        }
        if (row.status === 'declined' || row.status === 'missed') {
          clearTimeout(ringTimeoutRef.current)
          clearTimeout(resolvedClearRef.current)
          resolvedClearRef.current = setTimeout(() => setOutgoingCall(null), RESOLVED_CLEAR_MS)
          return { ...cur, status: row.status }
        }
        return cur
      })

      setActiveCall((cur) => (cur && cur.id === row.id && row.status === 'ended' ? null : cur))
    }

    const channel = supabase
      .channel(`calls:${myId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'calls', filter: `receiver_id=eq.${myId}` },
        async ({ new: row }) => {
          const { data: caller } = await supabase
            .from('profiles')
            .select('full_name, avatar_url, avatar_emoji')
            .eq('id', row.caller_id)
            .single()
          if (!active) return
          setIncomingCall({
            id: row.id,
            conversationId: row.conversation_id,
            roomUrl: row.room_url,
            callerId: row.caller_id,
            callerName: caller?.full_name || 'Someone',
            callerAvatarUrl: caller?.avatar_url,
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calls', filter: `receiver_id=eq.${myId}` },
        ({ new: row }) => applyUpdate(row)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calls', filter: `caller_id=eq.${myId}` },
        ({ new: row }) => applyUpdate(row)
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
      clearTimeout(ringTimeoutRef.current)
      clearTimeout(resolvedClearRef.current)
    }
  }, [myId])

  async function placeCall({ conversationId, receiverId, receiverName }) {
    const call = await startCall({ conversationId, callerId: myId, receiverId })
    setOutgoingCall({
      id: call.id,
      conversationId,
      roomUrl: call.room_url,
      receiverId,
      receiverName,
      status: 'ringing',
    })

    ringTimeoutRef.current = setTimeout(async () => {
      try {
        await markMissed(call.id)
      } catch {
        // best-effort — if this races a real response the .eq('status','ringing')
        // guard in markMissed already makes it a no-op
      }
      setOutgoingCall((cur) => (cur && cur.id === call.id ? { ...cur, status: 'missed' } : cur))
      resolvedClearRef.current = setTimeout(() => setOutgoingCall(null), RESOLVED_CLEAR_MS)
    }, RING_TIMEOUT_MS)
  }

  // Caller hanging up their own ring before the receiver responds — reuses
  // markMissed rather than a dedicated status so RLS/the enum stay minimal.
  async function cancelOutgoingCall() {
    setOutgoingCall((cur) => {
      if (cur) markMissed(cur.id).catch(() => {})
      return null
    })
    clearTimeout(ringTimeoutRef.current)
  }

  async function respondAccept() {
    setIncomingCall((cur) => {
      if (cur) {
        setActiveCall({ id: cur.id, roomUrl: cur.roomUrl, otherName: cur.callerName })
        acceptCall(cur.id).catch(() => setActiveCall(null))
      }
      return null
    })
  }

  async function respondDecline() {
    setIncomingCall((cur) => {
      if (cur) declineCall(cur.id).catch(() => {})
      return null
    })
  }

  async function leaveActiveCall() {
    setActiveCall((cur) => {
      if (cur) endCall(cur.id).catch(() => {})
      return null
    })
  }

  const value = {
    incomingCall,
    outgoingCall,
    activeCall,
    placeCall,
    cancelOutgoingCall,
    respondAccept,
    respondDecline,
    leaveActiveCall,
  }

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>
}

export function useCall() {
  return useContext(CallContext)
}
