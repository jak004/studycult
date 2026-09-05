// Backs the "Ask AI" page — a 24/7 AI study-help chat that sits alongside
// (not instead of) messaging a human tutor. Stateless: the client resends the
// rolling conversation history each turn, nothing is persisted server-side.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { groqChat } from '../_shared/groq.ts'
import { corsHeaders, handlePreflight } from '../_shared/cors.ts'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const SYSTEM_PROMPT = `You are the AI study tutor built into StudyCult, a tutoring platform. You help students understand concepts across any school or university subject.

Default teaching cycle for a new concept or "explain X" / "help me understand X" question — follow all three steps in the same reply unless the student interrupts the flow:
1. Explain the concept simply, in your own words, with a concrete example.
2. Check understanding with one short, specific question about what you just explained (not a generic "does that make sense?").
3. Offer one small practice problem the student can try, and say you'll check their answer when they reply with it.

When the student answers your check-understanding question or attempts the practice problem, tell them clearly whether they got it right, correct any misconception concisely, and only then move on (offer the next concept, a harder practice problem, or ask what they want next).

Skip the cycle and answer directly when the student clearly just wants a fact, formula, definition, or quick lookup (e.g. "what's the formula for X", "define Y") — don't stall a direct question behind Socratic questioning.

Style:
- Be warm, encouraging, and patient.
- Keep answers concise: short paragraphs, plain text, no markdown headers. Use numbered or dashed lists only when they genuinely help.
- If a question is outside academics entirely, gently redirect to studying.`

// Keeps the request bounded — Groq's free tier has rate limits, and nothing
// here needs more than recent context to answer well.
const MAX_HISTORY = 12
const MAX_MESSAGE_LENGTH = 4000

type ChatMessage = { role: 'user' | 'assistant'; content: string }

function isValidHistory(messages: unknown): messages is ChatMessage[] {
  return (
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.every(
      (m) =>
        m &&
        typeof m === 'object' &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.trim().length > 0 &&
        m.content.length <= MAX_MESSAGE_LENGTH
    )
  )
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
  if (!user) return json({ error: 'Unauthorized' })

  if (!Deno.env.get('GROQ_API_KEY')) {
    return json({ error: 'The AI tutor is not set up yet (missing GROQ_API_KEY)' })
  }

  const { messages } = await req.json()
  if (!isValidHistory(messages)) {
    return json({ error: 'Invalid message history' })
  }

  const trimmed = messages.slice(-MAX_HISTORY)

  let reply: string
  try {
    reply = await groqChat([{ role: 'system', content: SYSTEM_PROMPT }, ...trimmed])
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'The AI tutor could not respond — try again' })
  }

  return json({ reply })
})
