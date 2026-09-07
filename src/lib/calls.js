import { supabase } from './supabaseClient'

// Same deterministic Jitsi room the existing "Start video call" button in
// ChatWindow opens — https://meet.jit.si needs no account/API key/room
// creation call, just a stable name, so a call and an ad-hoc video join
// always land in the same room for a given conversation.
export function jitsiRoomUrl(conversationId) {
  return `https://meet.jit.si/studycult-${conversationId}`
}

export async function startCall({ conversationId, callerId, receiverId }) {
  const { data, error } = await supabase
    .from('calls')
    .insert({
      conversation_id: conversationId,
      room_url: jitsiRoomUrl(conversationId),
      caller_id: callerId,
      receiver_id: receiverId,
      status: 'ringing',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function acceptCall(callId) {
  const { error } = await supabase
    .from('calls')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', callId)
  if (error) throw error
}

export async function declineCall(callId) {
  const { error } = await supabase
    .from('calls')
    .update({ status: 'declined', responded_at: new Date().toISOString() })
    .eq('id', callId)
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
