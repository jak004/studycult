async function hmac(secret: string, message: string) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function secretOrThrow() {
  const secret = Deno.env.get('UNSUBSCRIBE_SECRET')
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET is not set')
  return secret
}

export async function buildUnsubscribeUrl(userId: string, prefType: string) {
  const sig = await hmac(secretOrThrow(), `${userId}:${prefType}`)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  return `${supabaseUrl}/functions/v1/unsubscribe?uid=${userId}&type=${prefType}&sig=${sig}`
}

export async function verifySignature(userId: string, prefType: string, sig: string) {
  const expected = await hmac(secretOrThrow(), `${userId}:${prefType}`)
  return expected === sig
}
