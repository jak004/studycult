const DAILY_BASE = 'https://api.daily.co/v1'

function secretKey() {
  const key = Deno.env.get('DAILY_API_KEY')
  if (!key) throw new Error('DAILY_API_KEY is not set')
  return key
}

async function dailyRequest(path: string, options: { method?: string; body?: unknown } = {}) {
  const res = await fetch(`${DAILY_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(`Daily error (${path}): ${json.error ?? json.info ?? res.status}`)
  }
  return json
}

// One room per call attempt (not per conversation) — a fresh unguessable
// name sidesteps ever hitting Daily's 409-if-name-exists case, and `exp`
// means a room nobody joins just expires on Daily's side rather than
// needing a cleanup job here. Public (not "private") because reaching it
// is already gated by the `calls` row's RLS — only the caller and receiver
// ever learn this URL — so there's no need for Daily's own per-participant
// meeting tokens on top of that.
export function createCallRoom() {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 2 // 2 hours out
  return dailyRequest('/rooms', {
    method: 'POST',
    body: {
      name: `studycult-${crypto.randomUUID()}`,
      privacy: 'public',
      // enable_prejoin_ui: false — both sides already went through our own
      // ring/accept handshake, so Daily's own "click to join" device-check
      // screen would just be a redundant second confirmation.
      properties: { exp, eject_at_room_exp: true, enable_prejoin_ui: false },
    },
  })
}
