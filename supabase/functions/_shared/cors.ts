// Every function called directly from the browser (via supabase.functions.invoke)
// needs this — browsers send a CORS preflight (OPTIONS) before the real
// request, and Supabase's Edge Runtime doesn't add CORS headers on its own.
// Without handling it, the preflight gets rejected and the browser reports
// the whole call as a network failure ("Failed to send a request to the
// Edge Function"), even though the function itself is fine.
//
// Not needed by functions only ever called server-to-server (Database
// Webhooks, Paystack's webhook, cron) — no browser is involved, so there's
// no preflight to handle.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function handlePreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  return null
}
