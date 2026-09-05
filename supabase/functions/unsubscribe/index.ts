// Public endpoint (no auth) that a click from an email lands on. Verifies the
// signed link, flips one notification_prefs flag, and shows a confirmation page.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifySignature } from '../_shared/unsubscribe.ts'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

function htmlResponse(message: string, status = 200) {
  return new Response(
    `<!doctype html><html><body style="font-family:sans-serif;max-width:420px;margin:80px auto;text-align:center;color:#16233d;">
       <h1 style="font-size:18px;">StudyCult</h1>
       <p>${message}</p>
     </body></html>`,
    { status, headers: { 'Content-Type': 'text/html' } }
  )
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const uid = url.searchParams.get('uid')
  const type = url.searchParams.get('type')
  const sig = url.searchParams.get('sig')

  if (!uid || !type || !sig) return htmlResponse('Missing link parameters.', 400)

  const valid = await verifySignature(uid, type, sig)
  if (!valid) return htmlResponse('This unsubscribe link is invalid or has expired.', 400)

  const { data: profile } = await supabase.from('profiles').select('notification_prefs').eq('id', uid).single()
  if (!profile) return htmlResponse('Account not found.', 404)

  const prefs = { ...((profile.notification_prefs ?? {}) as Record<string, boolean>), [type]: false }
  await supabase.from('profiles').update({ notification_prefs: prefs }).eq('id', uid)

  return htmlResponse(`You've been unsubscribed from "${type}" emails. You can turn them back on any time from your profile.`)
})
