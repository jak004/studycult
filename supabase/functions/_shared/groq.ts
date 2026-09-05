// Groq's API is OpenAI-compatible (same request/response shape, different
// base URL), which is why this reads so similarly to the OpenAI calls it
// replaced. Free tier, no card required — see the README for getting a key.
const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions'

// A current, generally-available Groq model as of when this was written —
// Groq's lineup changes over time (llama-3.3-70b-versatile, used here
// originally, was retired entirely), so if this starts 404ing/"model not
// found", check https://console.groq.com/docs/models for the current model
// id and swap it in here (one place, every caller below uses it).
const MODEL = 'openai/gpt-oss-120b'

function apiKey() {
  const key = Deno.env.get('GROQ_API_KEY')
  if (!key) throw new Error('GROQ_API_KEY is not set')
  return key
}

// Groq's JSON mode is less consistently strict than OpenAI's about emitting
// ONLY the JSON object — this pulls the first {...} blob out of whatever
// text comes back, so a stray preamble/code fence doesn't break parsing.
function extractJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON object found in the model response')
  return JSON.parse(match[0])
}

export async function groqJson(prompt: string, { temperature = 0.4 }: { temperature?: number } = {}) {
  const res = await fetch(GROQ_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature,
    }),
  })

  if (!res.ok) {
    throw new Error(`Groq error: ${await res.text()}`)
  }

  const completion = await res.json()
  return extractJson(completion.choices[0].message.content)
}

export async function groqText(prompt: string, { temperature = 0 }: { temperature?: number } = {}) {
  const res = await fetch(GROQ_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature,
    }),
  })

  if (!res.ok) {
    throw new Error(`Groq error: ${await res.text()}`)
  }

  const completion = await res.json()
  return String(completion.choices[0].message.content).trim()
}

// Multi-turn variant for the AI tutor chat — `messages` should already
// include a leading system prompt plus the rolling conversation history.
export async function groqChat(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  { temperature = 0.6 }: { temperature?: number } = {}
) {
  const res = await fetch(GROQ_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, messages, temperature }),
  })

  if (!res.ok) {
    throw new Error(`Groq error: ${await res.text()}`)
  }

  const completion = await res.json()
  return String(completion.choices[0].message.content).trim()
}
