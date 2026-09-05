// Called from the "Import from resume" button on the Profile settings page.
// Like generate-quiz-questions, this only ever sees text the browser already
// extracted from a PDF (see src/lib/pdf.js) — never the file itself. Returns
// a DRAFT for the tutor's own form fields; nothing here writes to the
// database directly, since an LLM misreading a resume shouldn't silently
// overwrite someone's real profile.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { groqJson } from '../_shared/groq.ts'
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
  if (!user) return json({ error: 'Unauthorized' })

  const { data: profile } = await serviceClient.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'tutor') return json({ error: 'Only tutors can import a resume' })

  if (!Deno.env.get('GROQ_API_KEY')) {
    return json({ error: 'Resume import is not set up yet (missing GROQ_API_KEY)' })
  }

  const { text } = await req.json()
  if (!text || String(text).trim().length < 50) {
    return json({ error: 'Not enough text was extracted from that file' })
  }

  const prompt = `Read this resume/CV and draft a short tutor profile from it. Respond with ONLY valid JSON in this exact shape, nothing else: {"bio": "a 2-3 sentence professional summary written in first person, suitable for a tutoring profile", "subjects": ["subject or skill area they could tutor in", "..."], "languages": ["language", "..."]}. Only include languages if the resume actually mentions them; otherwise return an empty array. Base everything strictly on the resume — do not invent qualifications it doesn't contain.

RESUME:
"""
${text}
"""`

  let parsed: { bio?: unknown; subjects?: unknown; languages?: unknown }
  try {
    parsed = await groqJson(prompt, { temperature: 0.3 })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Could not parse the resume — try again' })
  }

  const bio = typeof parsed.bio === 'string' ? parsed.bio : ''
  const subjects = Array.isArray(parsed.subjects) ? parsed.subjects.filter((s) => typeof s === 'string') : []
  const languages = Array.isArray(parsed.languages) ? parsed.languages.filter((l) => typeof l === 'string') : []

  if (!bio && subjects.length === 0) {
    return json({ error: 'Could not draft a profile from that resume — try a different file' })
  }

  return json({ bio, subjects, languages })
})
