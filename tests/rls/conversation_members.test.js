// Runs only against a local Supabase stack (`supabase start`), never as part
// of the default `npm test` — see `npm run test:rls` and the README's
// "Testing" section for the three env vars this needs (from `supabase
// status`). NOTE: unlike the component tests in src/, this file has not been
// executed against a real instance in this environment (no Docker
// available) — it's written correctly against documented Postgres/PostgREST
// behavior (42501 = insufficient_privilege for an RLS rejection, 23505 =
// unique_violation), but treat it as unverified until you run it once.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const LOCAL_URL = process.env.SUPABASE_LOCAL_URL
const ANON_KEY = process.env.SUPABASE_LOCAL_ANON_KEY
const SERVICE_ROLE_KEY = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY
const hasLocalStack = Boolean(LOCAL_URL && ANON_KEY && SERVICE_ROLE_KEY)

describe.skipIf(!hasLocalStack)('RLS: conversation_members insert policy', () => {
  // Not created at the describe body's top level — skipIf still runs that
  // synchronous code during test collection even when skipped, so a bare
  // createClient(undefined, undefined) here would throw regardless.
  let admin
  const password = 'CorrectHorse1!'
  let userA
  let stranger
  let conversationId

  async function createSignedInUser(label) {
    const email = `rls-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `RLS ${label}`, role: 'student' },
    })
    if (error) throw error

    const client = createClient(LOCAL_URL, ANON_KEY)
    const { error: signInError } = await client.auth.signInWithPassword({ email, password })
    if (signInError) throw signInError

    return { id: data.user.id, client }
  }

  beforeAll(async () => {
    admin = createClient(LOCAL_URL, SERVICE_ROLE_KEY)
    userA = await createSignedInUser('a')
    stranger = await createSignedInUser('stranger')

    const { data: conversation, error } = await admin
      .from('conversations')
      .insert({ is_group: false, created_by: userA.id })
      .select()
      .single()
    if (error) throw error
    conversationId = conversation.id

    await admin.from('conversation_members').insert({ conversation_id: conversationId, user_id: userA.id })
  })

  afterAll(async () => {
    if (conversationId) await admin.from('conversations').delete().eq('id', conversationId)
    if (userA) await admin.auth.admin.deleteUser(userA.id)
    if (stranger) await admin.auth.admin.deleteUser(stranger.id)
  })

  it('fails on the unique constraint (not RLS) when a member re-adds themselves', async () => {
    const { error } = await userA.client
      .from('conversation_members')
      .insert({ conversation_id: conversationId, user_id: userA.id })
    // Proves the earlier successful insert actually happened under RLS, and
    // isolates this from the "blocked by RLS" case below by using a
    // different, unambiguous error code.
    expect(error?.code).toBe('23505')
  })

  it("blocks a stranger from adding themselves to someone else's conversation", async () => {
    const { error } = await stranger.client
      .from('conversation_members')
      .insert({ conversation_id: conversationId, user_id: stranger.id })
    expect(error?.code).toBe('42501')
  })

  it("blocks a stranger from adding userA to a conversation on their behalf", async () => {
    const { error } = await stranger.client
      .from('conversation_members')
      .insert({ conversation_id: conversationId, user_id: userA.id })
    expect(error?.code).toBe('42501')
  })
})
