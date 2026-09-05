const PAYSTACK_BASE = 'https://api.paystack.co'

function secretKey() {
  const key = Deno.env.get('PAYSTACK_SECRET_KEY')
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not set')
  return key
}

async function paystackRequest(path: string, options: { method?: string; body?: unknown } = {}) {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const json = await res.json()
  if (!res.ok || json.status === false) {
    throw new Error(`Paystack error (${path}): ${json.message ?? res.status}`)
  }
  return json.data
}

export function initializeTransaction({
  email,
  amountMinor,
  reference,
  callbackUrl,
}: {
  email: string
  amountMinor: number
  reference: string
  callbackUrl: string
}) {
  return paystackRequest('/transaction/initialize', {
    method: 'POST',
    body: { email, amount: amountMinor, reference, callback_url: callbackUrl },
  })
}

export function createTransferRecipient({
  type,
  name,
  accountNumber,
  bankCode,
  currency,
}: {
  type: 'nuban' | 'mobile_money' | 'ghipss'
  name: string
  accountNumber: string
  bankCode: string
  currency: string
}) {
  return paystackRequest('/transferrecipient', {
    method: 'POST',
    body: { type, name, account_number: accountNumber, bank_code: bankCode, currency },
  })
}

export function initiateTransfer({
  amountMinor,
  recipientCode,
  reference,
  reason,
}: {
  amountMinor: number
  recipientCode: string
  reference: string
  reason: string
}) {
  return paystackRequest('/transfer', {
    method: 'POST',
    body: { source: 'balance', amount: amountMinor, recipient: recipientCode, reference, reason },
  })
}

export function listBanks(currency: string) {
  return paystackRequest(`/bank?currency=${currency}&country=ghana`)
}

// Paystack signs webhook bodies with HMAC-SHA512 of the raw request body,
// using the *secret* key — must be checked before trusting anything the
// payload claims happened.
export async function verifyWebhookSignature(rawBody: string, signatureHeader: string | null) {
  if (!signatureHeader) return false
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secretKey()), { name: 'HMAC', hash: 'SHA-512' }, false, [
    'sign',
  ])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody))
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return hex === signatureHeader
}
