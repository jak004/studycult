import { supabase } from './supabaseClient'

// Find an existing 1:1 (non-group) conversation between two users, or create one.
export async function getOrCreateDirectConversation(myId, otherId) {
  const { data: mine } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', myId)

  const { data: theirs } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', otherId)

  const mineIds = new Set((mine || []).map((r) => r.conversation_id))
  const sharedIds = (theirs || []).map((r) => r.conversation_id).filter((id) => mineIds.has(id))

  if (sharedIds.length > 0) {
    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .in('id', sharedIds)
      .eq('is_group', false)
      .limit(1)
      .maybeSingle()
    if (existing) return existing
  }

  const { data: conversation, error } = await supabase
    .from('conversations')
    .insert({ is_group: false, created_by: myId })
    .select()
    .single()

  if (error) throw error

  await supabase.from('conversation_members').insert([
    { conversation_id: conversation.id, user_id: myId },
    { conversation_id: conversation.id, user_id: otherId },
  ])

  return conversation
}

export async function createStudyRoom({ name, subject, myId }) {
  const { data: conversation, error } = await supabase
    .from('conversations')
    .insert({ is_group: true, name, subject, created_by: myId })
    .select()
    .single()

  if (error) throw error

  const { error: memberError } = await supabase
    .from('conversation_members')
    .insert([{ conversation_id: conversation.id, user_id: myId }])

  if (memberError) throw memberError

  return conversation
}

export async function joinStudyRoom({ conversationId, myId }) {
  // Deliberately a plain insert, not an upsert/ON CONFLICT — verified directly
  // against Postgres that ON CONFLICT (even DO NOTHING) needs SELECT-level RLS
  // visibility into the *existing* row to check for a conflict, and the only
  // SELECT policy on conversation_members is "you're already a member". Someone
  // joining for the first time isn't a member yet, so that visibility check
  // itself gets denied and the whole statement fails as an RLS violation —
  // before ever reaching the actual insert. A plain insert only needs the
  // INSERT policy (auth.uid() = user_id, always true when joining yourself)
  // and a genuine re-join just hits a clean 23505 unique-violation, caught
  // below as the harmless no-op it actually is.
  const { error } = await supabase.from('conversation_members').insert({ conversation_id: conversationId, user_id: myId })

  if (error && error.code !== '23505') throw error
}
