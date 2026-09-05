// Called from the "Create quiz" form after the browser extracts text from an
// uploaded PDF (see src/lib/pdf.js) — this function never sees the PDF
// itself, only the extracted text, which keeps it simple and avoids needing
// a PDF parser in Deno. Returns a DRAFT the tutor reviews/edits before
// publishing; nothing here writes to quiz_questions directly, since
// auto-publishing unreviewed AI output is exactly the failure mode to avoid.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { groqJson } from '../_shared/groq.ts'
import { corsHeaders, handlePreflight } from '../_shared/cors.ts'

const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

type DraftQuestion = { question: string; options: string[]; correct_index: number }

function isValidQuestion(q: unknown): q is DraftQuestion {
  if (!q || typeof q !== 'object') return false
  const candidate = q as Record<string, unknown>
  return (
    typeof candidate.question === 'string' &&
    Array.isArray(candidate.options) &&
    candidate.options.length === 4 &&
    candidate.options.every((o) => typeof o === 'string') &&
    Number.isInteger(candidate.correct_index) &&
    (candidate.correct_index as number) >= 0 &&
    (candidate.correct_index as number) < 4
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

  const { data: profile } = await serviceClient.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'tutor') return json({ error: 'Only tutors can generate quiz questions' })

  if (!Deno.env.get('GROQ_API_KEY')) {
    return json({ error: 'Quiz generation is not set up yet (missing GROQ_API_KEY)' })
  }

  const { text, count } = await req.json()
  if (!text || String(text).trim().length < 50) {
    return json({ error: 'Not enough text was extracted from that file to generate questions' })
  }

  const questionCount = Math.min(Math.max(Number(count) || 5, 1), 10)

  const prompt = `You are creating a multiple-choice quiz from the study material below. Write exactly ${questionCount} questions, each with exactly 4 answer options and exactly one correct answer. Base every question strictly on the given material — do not invent facts that aren't in it. Respond with ONLY valid JSON in this exact shape, nothing else: {"questions": [{"question": "string", "options": ["string","string","string","string"], "correct_index": 0}]}

MATERIAL:
"""
${text}
"""`

  let parsed: { questions?: unknown[] }
  try {
    parsed = await groqJson(prompt)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Could not generate questions — try again' })
  }

  const questions = (parsed.questions ?? []).filter(isValidQuestion)
  if (questions.length === 0) {
    return json({ error: 'The AI did not return any usable questions — try again or with different slides' })
  }

  return json({ questions })
})
