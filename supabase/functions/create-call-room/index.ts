// Called by the caller's browser right before inserting the ringing `calls`
// row (see src/lib/calls.js) — creates the Daily room and hands back its
// URL. The API key never reaches the client: it only lives here as the
// DAILY_API_KEY secret.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createCallRoom } from '../_shared/daily.ts'
import { corsHeaders, handlePreflight } from '../_shared/cors.ts'

const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight

  const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const {
    data: { user },
  } = await anonClient.auth.getUser()
  if (!user) return json({ error: 'Unauthorized' }, 401)

  const { conversation_id, receiver_id } = await req.json()
  if (!conversation_id || !receiver_id) return json({ error: 'conversation_id and receiver_id are required' }, 400)

  // Same membership check the `calls` insert policy makes — done here too
  // so an unauthorized request never even reaches the Daily API (a room
  // costs Daily-side quota to create, unlike the `calls` insert itself).
  const { data: members } = await serviceClient
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', conversation_id)
    .in('user_id', [user.id, receiver_id])

  const memberIds = new Set((members ?? []).map((m) => m.user_id))
  if (!memberIds.has(user.id) || !memberIds.has(receiver_id)) {
    return json({ error: 'Not a member of this conversation' }, 403)
  }

  try {
    const room = await createCallRoom()
    return json({ room_url: room.url, room_name: room.name })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Could not create the call room' }, 500)
  }
})
