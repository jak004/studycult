// Triggered by a Database Webhook on INSERT into public.messages. Flags
// rather than blocks — the message is already delivered by the time this
// runs, which is the point: a false positive here costs nothing, whereas
// blocking synchronously on an unreliable check would cost real messages.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { groqText } from '../_shared/groq.ts'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

async function checkBlocklist(content: string) {
  const { data: terms } = await supabase.from('moderation_blocklist').select('term')
  const lower = content.toLowerCase()
  const hit = (terms ?? []).find((t) => lower.includes(t.term.toLowerCase()))
  return hit ? `blocklist:${hit.term}` : null
}

// Optional — only runs if GROQ_API_KEY is set. Uses a plain classification
// prompt on a general chat model rather than a dedicated moderation
// endpoint/model (Groq does host purpose-built guard models, but their
// expected prompt format isn't something to guess at rather than verify) —
// simpler and more predictable, at the cost of being less rigorously tuned
// than a real moderation-specific model.
async function checkGroqModeration(content: string) {
  if (!Deno.env.get('GROQ_API_KEY')) return null
  try {
    const prompt = `You are a content moderation classifier for a tutoring platform's chat. Reply with ONLY one word: SAFE, or UNSAFE if the message contains harassment, hate speech, threats, explicit sexual content, or scam/spam content.

MESSAGE:
"""
${content}
"""`
    const verdict = await groqText(prompt)
    if (!verdict.toUpperCase().startsWith('UNSAFE')) return null
    return 'groq:flagged'
  } catch (err) {
    console.error('Groq moderation check failed', err)
    return null
  }
}

Deno.serve(async (req) => {
  const { record } = (await req.json()) as { record: { id: string; content: string } }

  const reason = (await checkBlocklist(record.content)) ?? (await checkGroqModeration(record.content))

  if (reason) {
    await supabase.from('messages').update({ flagged: true, flag_reason: reason }).eq('id', record.id)
  }

  return new Response('ok')
})
