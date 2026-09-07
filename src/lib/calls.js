import { supabase } from './supabaseClient'

// Public meet.jit.si (used elsewhere in this app for ad-hoc group calls)
// requires whoever's first into a room to log in with a Google/GitHub/etc
// account as of Jitsi's August 2023 policy change — a dealbreaker for a
// ring-and-answer flow where either side might be first. Daily.co's
// create-room Edge Function keeps the API key server-side and gives every
// 1:1 call its own login-free room.
export async function startCall({ conversationId, callerId, receiverId }) {
  const { data: room, error: roomError } = await supabase.functions.invoke('create-call-room', {
    body: { conversation_id: conversationId, receiver_id: receiverId },
  })
  if (roomError) throw roomError
  if (room?.error) throw new Error(room.error)

  const { data, error } = await supabase
    .from('calls')
    .insert({
      conversation_id: conversationId,
      room_url: room.room_url,
      caller_id: callerId,
      receiver_id: receiverId,
      status: 'ringing',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// .select().single() on purpose (unlike the best-effort updates below): a
// plain .update() with no .select() reports success even when RLS quietly
// matched zero rows, which would otherwise show up as the receiver's call
// screen closing itself right after they accept, with no error anywhere —
// .single() forces a real error when the row isn't actually there.
export async function acceptCall(callId) {
  const { error } = await supabase
    .from('calls')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', callId)
    .select()
    .single()
  if (error) throw error
}

export async function declineCall(callId) {
  const { error } = await supabase
    .from('calls')
    .update({ status: 'declined', responded_at: new Date().toISOString() })
    .eq('id', callId)
    .select()
    .single()
  if (error) throw error
}

// Caller-side timeout when the receiver never responds — see CallContext's
// 30s timer. A plain update, not upsert: if the row already moved to
// accepted/declined by the time this fires, this is scoped with `.eq('status',
// 'ringing')` so it's a harmless no-op rather than clobbering their response.
export async function markMissed(callId) {
  const { error } = await supabase
    .from('calls')
    .update({ status: 'missed', responded_at: new Date().toISOString() })
    .eq('id', callId)
    .eq('status', 'ringing')
  if (error) throw error
}

export async function endCall(callId) {
  const { error } = await supabase
    .from('calls')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', callId)
    .in('status', ['accepted', 'ringing'])
  if (error) throw error
}
