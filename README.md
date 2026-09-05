# StudyCult

A study platform connecting tutors and students — with real-time 1:1 chat, group
study rooms (student-to-student), and quizzes tutors can build and students can take.

## Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Supabase (Postgres, Auth, Realtime) — no server to run yourself

## What's real vs. what still needs one step

Everything in this app is fully implemented, working code — nothing is a fake
"coming soon" button. A handful of pieces are complete but sit inactive until
a real third-party credential is pasted in, which is a five-minute config
step, not remaining engineering work. Listed here once, so it doesn't have to
be rediscovered by testing every feature:

- **Google sign-in** — needs a Client ID/Secret from Google Cloud Console
  pasted into Supabase's provider settings. See "Enable Google sign-in" below.
- **hCaptcha on signup** — needs a site + secret key pair from hcaptcha.com.
  See "Security beyond RLS" below. Signup works fine without it; the captcha
  step is just skipped.
- **Error tracking (Sentry) and analytics (Plausible)** — both need a real
  DSN / deployed domain. See "Observability" below.
- **Payments (Paystack)** — the integration itself is real (escrow hold,
  webhook-verified release, real payout recipients), currently running on
  Paystack **test-mode** keys, which is normal for a class project, not a
  gap to fix before demoing.
- **Video calls** — real Jitsi rooms with real call signaling (a broadcast
  pings whoever else has that conversation open, plus a persistent
  notification for whoever doesn't). It is not a full VoIP push-calling
  system: if the other person isn't currently in the app at all, they only
  find out via the notification bell, possibly after the call ended.
- **Terms & Privacy pages** — deliberately marked as drafts, not
  lawyer-reviewed. Fine for a demo, not for a real launch.
- **CI** (`.github/workflows/ci.yml`) — written and correct, but inactive
  until this becomes a git repo with a GitHub remote (see "Testing" below).
- **Local-language accessibility support** — intentionally not built. The
  app has high-contrast mode and read-aloud today; translated UI would need
  real, reviewed translations rather than unverified machine translation, so
  it's scoped out rather than shipped wrong.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account/project.
2. In your project, go to **Project Settings → API**. You'll need:
   - **Project URL**
   - **anon public key**
3. Apply the database schema — see **Database migrations** below.
4. Go to **Authentication → Providers → Email** and make sure "Confirm email" is
   **on** (it's on by default). Password sign-ups then get a confirmation email
   right after creating their account — "your account was created, click to
   confirm" — and can't log in until they click it. This is the standard pattern
   most apps use (Gmail, Notion, etc.): confirm your email once at signup, then
   log in with just email + password from then on, no code required each time.

### Enable Google sign-in

1. In Supabase: **Authentication → Providers → Google** → toggle it on.
2. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   create an OAuth 2.0 Client ID (type: Web application).
3. Add Supabase's callback URL as an **Authorized redirect URI** — Supabase shows you
   the exact URL on the same provider settings page
   (`https://<project-ref>.supabase.co/auth/v1/callback`).
4. Copy the **Client ID** and **Client Secret** from Google back into the Supabase
   Google provider settings and save.

Google sign-ups don't carry a role, so the app routes first-time Google users to
`/complete-profile` to choose student or tutor before letting them into the app.

## Database migrations

Schema changes live as timestamped SQL files in `supabase/migrations/`, applied
in order — not as one growing file you paste into the SQL Editor. This makes
every change reviewable on its own (see `git log -- supabase/migrations`) and
means the exact same sequence can be replayed against a second project (a
staging environment, or after a fresh clone).

**One-time setup, per machine:**
```bash
npm install -g supabase       # or: brew install supabase/tap/supabase
supabase login                 # opens a browser to authenticate
supabase link --project-ref your-project-ref   # find this in your Supabase project URL
```

**Apply all migrations to your linked project:**
```bash
supabase db push
```

**Make a schema change going forward** (never hand-edit old migration files —
old ones are history, not a draft):
```bash
supabase migration new short_description_here
# edit the generated supabase/migrations/<timestamp>_short_description_here.sql
supabase db push
```

## 2. Configure the app

```bash
cp .env.example .env
```

Edit `.env` and paste in your Project URL and anon key:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

## 3. Run it

```bash
npm install
npm run dev
```

Visit the printed localhost URL. Sign up twice in two browser windows (or
incognito) — once as a tutor, once as a student — to try the full flow:
tutor browsing, real-time chat, study rooms, and quizzes.

## Notification emails

New messages, quiz results, welcome emails, and a tutor's weekly digest are
sent by Edge Functions, not directly from the React app. This is separate from
the Auth SMTP settings — those only cover Supabase's own confirmation/reset
emails. Here's the full path from zero to live:

**1. Get a SendGrid API key** (see the earlier setup: Single Sender
Verification, no domain required) — you need a **Mail Send** API key, distinct
from any Auth SMTP credentials you already configured.

**2. Set secrets** (from the project root, after `supabase link`):
```bash
supabase secrets set SENDGRID_API_KEY=your-sendgrid-api-key
supabase secrets set SENDGRID_FROM_EMAIL=the-address-you-verified@example.com
supabase secrets set UNSUBSCRIBE_SECRET=any-long-random-string
supabase secrets set CRON_SECRET=another-long-random-string
supabase secrets set APP_URL=http://localhost:5173   # your real deployed URL, once you have one
```

**3. Deploy the functions:**
```bash
supabase functions deploy send-notification-email
supabase functions deploy unsubscribe
supabase functions deploy weekly-digest
supabase functions deploy session-reminders
```

**4. Wire the Database Webhook** (this is what actually calls
`send-notification-email` when a row is inserted into `events` — there's no
CLI command for this, it's dashboard-only):
Supabase → **Database → Webhooks → Create a new webhook**
- Table: `events`, Event: `Insert`
- Type: **Supabase Edge Functions**, pick `send-notification-email`
- Add an HTTP header: `Authorization: Bearer <your service_role key>` (Project
  Settings → API) — without this the function's default JWT check rejects the
  webhook's request.

**5. Turn on the scheduled jobs**: open both
`supabase/migrations/20260904130100_weekly_digest_cron.sql` and
`supabase/migrations/20260904150100_session_reminders_cron.sql`, replace
`<project-ref>` and `<cron-secret>` in each with your real project ref and the
exact `CRON_SECRET` value from step 2, then `supabase db push`. If
`pg_cron`/`pg_net` aren't available yet, enable them under **Database →
Extensions** first.

**6. Test it**: send a message from one test account to another (while the
recipient's tab is closed or idle for 5+ minutes), then check **Database →
Table Editor → events** — a row should appear with `emailed = true`. If it
stays `false` with no `skip_reason`, check the function's logs (**Edge
Functions → send-notification-email → Logs**) for the actual error.

## Payments (Paystack)

Stripe Connect doesn't support payout accounts in Ghana, so this uses Paystack
instead — with a meaningfully different shape than Stripe Connect: a student's
payment goes to the platform's own Paystack balance, and a tutor's share is
only transferred out (via a separate Paystack Transfer) once the tutor marks
the session `completed`. Nothing here auto-splits at charge time.

**1. Get Paystack test keys**: sign up at paystack.com, stay in **Test Mode**
(toggle top-left of the dashboard), and grab your test **Secret Key** from
Settings → API Keys & Webhooks. Test mode uses fake card numbers — no real
money moves, no live KYC needed yet.

**2. Set secrets:**
```bash
supabase secrets set PAYSTACK_SECRET_KEY=sk_test_your_test_secret_key
```
(`APP_URL`, if not already set from the notifications setup, is also used here
as the Paystack checkout callback URL.)

**3. Deploy the functions:**
```bash
supabase functions deploy create-payment
supabase functions deploy paystack-webhook
supabase functions deploy create-payout-recipient
supabase functions deploy release-payment
```

**4. Register the webhook** in the Paystack dashboard: Settings → API Keys &
Webhooks → Webhook URL → paste your deployed `paystack-webhook` function's URL
(`https://<project-ref>.supabase.co/functions/v1/paystack-webhook`). Unlike
`send-notification-email`, this isn't a Supabase Database Webhook — it's
configured entirely on Paystack's side, and Paystack signs each request itself
(verified in the function), so no Supabase JWT header is needed here.

**5. Test the flow end-to-end**: as a tutor, set an hourly rate (Profile) and
payout details (Profile → Payout details — for test mode you can put anything
plausible in the bank/account fields, though a genuinely invalid code will
still be rejected by Paystack's API with a visible error). As a student, book
and have the tutor confirm a session, then click **Pay now** on the Dashboard
— you'll land on Paystack's test checkout; use one of
[Paystack's test cards](https://paystack.com/docs/payments/test-payments/) to
"pay". Confirm the `payments` row flips to `paid` (via the webhook, not
instantly), then as the tutor click **Mark completed** followed by **Release
payment**, and confirm it eventually reaches `transferred`.

## Live video calls (Daily.co)

**1. Get a Daily.co API key**: sign up at daily.co (free tier is plenty for
testing) and grab your API key from the dashboard's Developers section.

**2. Set the secret and deploy:**
```bash
supabase secrets set DAILY_API_KEY=your-daily-api-key
supabase functions deploy create-video-room
```

**3. Test it**: open a conversation in **Messages**, click **🎥 Start video
call**. A Daily room is created on first click and reused on later clicks
(cached on the linked session if one exists, otherwise on the conversation) —
open the same conversation from a second test account to join the same room.

## Trust & safety

Tutor verification, reviews, reporting/blocking, and basic message moderation.
The admin review queue itself (approving verification documents, triaging
reports) isn't built here — it's referenced as its own later step — so
approving a tutor or reviewing a report happens by hand in the SQL Editor for
now:

```sql
-- Make yourself an admin (needed for the storage/report policies below to grant you anything)
update public.profiles set is_admin = true where id = 'your-user-uuid';

-- Approve a tutor's verification after checking their uploaded document
-- (Storage → verification-documents bucket → find their folder by user id)
update public.profiles set verification_status = 'verified' where id = 'tutor-user-uuid';
```

**1. (Optional) Add AI moderation** on top of the always-on blocklist — skip
this and only the blocklist runs. Uses Groq (free tier, see **AI features**
below for getting a key) rather than a paid provider:
```bash
supabase secrets set GROQ_API_KEY=your-groq-api-key
```

**2. Deploy the function:**
```bash
supabase functions deploy moderate-message
```

**3. Wire the Database Webhook** (same pattern as `send-notification-email`):
Supabase → **Database → Webhooks → Create a new webhook**
- Table: `messages`, Event: `Insert`
- Type: **Supabase Edge Functions**, pick `moderate-message`
- Header: `Authorization: Bearer <your service_role key>`

**4. Test it**: add a term to the blocklist (`insert into
public.moderation_blocklist (term) values ('testflag');`), send a message
containing it, then check that message's row in **Table Editor → messages** —
`flagged` should flip to `true` within a second or two. There's currently no
UI surfacing flagged messages (that's part of the deferred admin queue) — it's
purely a backend signal at this stage, which is deliberate: nothing here
should out a user to others based on an automated, possibly-wrong flag.

## Search & discovery

No deployment steps — this is schema + client only. The `search_vector`
column is trigger-maintained (not a `generated always as` column — see the
comment in the migration for why that specific approach doesn't work in
Postgres) and searched via `supabase-js`'s `.textSearch()`. Tutors gained a
`languages` field (Profile page) that feeds the new language filter. "Available
today" reuses the same slot-generation logic as booking (`src/lib/availability.js`)
rather than a separate, possibly-inconsistent definition of "available."

## File handling

Also no deployment steps beyond the migration. Two Storage buckets:
- `avatars` — public read, write restricted to your own folder. Upload a
  photo from **Profile**; it replaces the emoji avatar everywhere (Navbar,
  Tutors cards, Dashboard) but the emoji stays as the fallback if no photo is
  set.
- `chat-attachments` — private, RLS-scoped to conversation membership (mirrors
  the `messages` RLS pattern exactly). Click 📎 next to the message box in any
  conversation to send an image, video, or generic file; since the bucket is
  private, the app fetches a short-lived signed URL to actually display each
  attachment rather than a public link.

## Messaging upgrades

No deployment steps — client + one migration (`messages_attachment_type_check`
now also allows `audio`/`video`, not just `image`/`file`).

- **Timestamps**: every message shows its send time (in the viewer's own
  timezone) beneath the bubble.
- **Voice messages**: the 🎤 button records via the browser's
  `MediaRecorder` API, uploads the result to `chat-attachments` on stop, and
  renders as an inline `<audio>` player for everyone in the conversation.
- **Video attachments**: picking a video file through the existing 📎 button
  now renders inline with a `<video>` player instead of falling back to a
  generic download link.
- **Video calls**: unchanged from the Daily.co integration — deploy
  `create-video-room` (see **Live video calls** above) once you have a key.
- **Peer-to-peer (student-to-student) messaging**: a new **Peers** page
  (`/peers`, nav link shown to students only) lists other students with the
  same searchable, placeholder-avatar card pattern as **Tutors** — clicking
  Message reuses the existing `getOrCreateDirectConversation` helper, which
  was already generic enough to support any two users, not just tutor↔student.

## AI features (Groq)

Quiz generation from slides, resume-based profile drafting, and (optionally)
message moderation all call **Groq**, not OpenAI — Groq's free tier needs no
credit card and its API is OpenAI-compatible, so the same `_shared/groq.ts`
helper backs all three. Get a key:

1. **console.groq.com** → sign up → **API Keys** → create one. No billing
   required for the free tier.
2. Set it once for the whole project:
```bash
supabase secrets set GROQ_API_KEY=your-groq-api-key
```
This is a hard requirement for the two features below (they show a clear
"not set up yet" error without it), and optional for `moderate-message`
(covered earlier — it just skips the AI check and relies on the blocklist).

**Quiz generation from slides**: on **Quizzes → Create quiz**, a tutor can
upload a PDF of their slides/notes; the browser extracts its text (via
`pdfjs-dist`, loaded on demand so it's excluded from everyone's initial page
load) and sends that text — never the PDF itself — to `generate-quiz-questions`,
which asks Groq to draft multiple-choice questions from it. Generated
questions land in the same editable form as manually-typed ones — nothing
publishes until the tutor reviews and hits Publish, since auto-publishing
unreviewed AI output onto students is exactly the failure mode to avoid.
PPTX isn't supported — reliable text extraction from slide binaries needs
heavier tooling than a PDF's already-plain text layer.
```bash
supabase functions deploy generate-quiz-questions
```

## Settings, consent, resume import, and referrals

**Settings redesign**: `/profile` is now a sidebar-tabbed settings page
(`src/pages/settings/`) instead of one long scrolling form — Profile,
Availability/Payouts/Verification (tutors only), Payment history, Blocked
users, Refer a friend. Deep-links work via `?tab=`, e.g. `/profile?tab=availability`
(used by the Dashboard's "Manage availability" links). No deployment steps —
schema + client only, beyond what's below.

**Terms/Privacy consent at signup**: draft (not lawyer-reviewed — see the
in-page disclaimer) `/terms` and `/privacy` pages, plus a required checkbox on
Signup that gates account creation. Google sign-ups get an implied-consent
disclaimer under the button instead of a blocking checkbox, since the OAuth
flow doesn't stop for one. `profiles.terms_accepted_at` is stamped server-side
in `handle_new_user` — never trust a client-reported "yes" for something this
should be provable later.

**Resume/CV auto-fills a tutor's profile**: same PDF-text-extraction + Groq
pattern as slide-based quiz generation, applied to a resume instead — drafts
`bio`/`subjects`/`languages` into the Profile tab's form fields for review,
saved only when the tutor hits Save changes. Uses the same `GROQ_API_KEY`
secret from **AI features** above; deploy the function once that's set:
```bash
supabase functions deploy parse-resume
```

**Referral program**: a simplified version of PeerBooking's — no coupon/
reward-code system (what the actual reward is is a real product decision,
not something to guess at), just honest attribution. A user's referral link
is `/signup?ref=<their-user-id>`; a `referrals` row is written server-side
in `handle_new_user` when someone signs up through it, and only for password
signups — Google OAuth doesn't route through code we control, so referral
attribution doesn't carry through that path. No deployment steps.

## Admin

Make yourself an admin the same way you'd approve a tutor (SQL Editor, since
`is_admin` is deliberately not settable through the app itself):
```sql
update public.profiles set is_admin = true where id = 'your-user-uuid';
```
Reload the app — an **Admin** link appears in the navbar, leading to `/admin`:
pending tutor verifications (with a link to view their uploaded document),
open reports, three platform metrics (signups, conversations active in the
last 7 days, quizzes taken in the last 7 days), and two analytics charts
(signups and released-payout revenue over the last 14 days, plus an all-time
session-status breakdown) — all hand-rolled SVG, no charting dependency. No
deployment steps — schema + client only.

**Demo data**, also on `/admin`: seeds a handful of realistic tutors,
students, courses, sessions, and quiz history via the `seed-demo-data` Edge
Function, for showing the app to someone without an empty database. Every
demo account's email ends in `@studycult.demo`; "Clear demo data" finds and
removes all of them (and everything that references them — courses, sessions,
payments, quiz attempts) without touching real users. Seeding always clears
first, so it's safe to run repeatedly. Deploy with
`supabase functions deploy seed-demo-data`.

## Courses

A tutor can bundle a persistent slide/reading library with a set of quizzes
into a **Course**, instead of slides only existing transiently as
quiz-generation input. Materials and courses are open-read to any signed-in
user — same browse-first philosophy as Tutors and Quizzes — so enrolling
(`course_enrollments`) is a personal progress marker, not an access gate.
Uploaded files land in a private `course-materials` Storage bucket (mirrors
the `chat-attachments` pattern: path-prefixed by course id, checked against
the owning row); a plain-text reading skips storage entirely and just stores
its content on the `course_materials` row. A quiz can optionally hang off a
course via `quizzes.course_id` (nullable — standalone quizzes from the
Quizzes page are unaffected). Students see enrolled-course progress (quizzes
attempted / total) on their dashboard. No deployment steps beyond the
`20260906030000_courses.sql` migration.

## Security beyond RLS

**Rate limiting** is enforced as Postgres triggers on `messages` and
`quiz_attempts` (20 messages/minute, 10 quiz submissions/minute per user) —
not an Edge Function, and not Supabase's built-in rate limiting, which is real
but specific to Auth endpoints (signup, OTP, token refresh) and doesn't extend
to arbitrary tables. A trigger holds no matter which code path performs the
insert. No deployment steps; test it by sending >20 messages in under a
minute — the 21st fails with a "Rate limit exceeded" error surfaced right in
the chat UI.

**hCaptcha on signup:**
1. Get a site key + secret key from hcaptcha.com.
2. In Supabase: **Authentication → Settings → Bot and Abuse Protection** →
   enable hCaptcha, paste the **secret** key.
3. In `.env`, set `VITE_HCAPTCHA_SITE_KEY` to the **site** key (public, safe
   client-side — same category as the anon key).
4. Restart `npm run dev`. The Signup page now shows a captcha widget above
   the submit button, and `signUp` passes its token through to Supabase Auth.
   Leaving `VITE_HCAPTCHA_SITE_KEY` unset skips the widget entirely (useful
   for local dev) rather than breaking signup.

**Audit log** (`audit_log` table): genuinely append-only — no update or
delete policy exists for any role, admin included, so the only way to alter a
row is a superuser at the database level. Written to by: `/admin` actions
(verify/reject a tutor, change a report's status) and the payment Edge
Functions (`paystack-webhook` on every status change, `release-payment` on
each payout initiation). View it via **Table Editor → audit_log** (no UI for
it yet — reasonable to add once /admin needs it).

## Project structure

```
src/
  context/AuthContext.jsx   → session + profile, app-wide
  lib/supabaseClient.js     → Supabase client
  lib/conversations.js      → chat helpers (find/create direct chat, study rooms)
  components/               → Navbar, ProtectedRoute, ChatWindow, BarChart
  pages/                    → Landing, Login, Signup, Dashboard, Tutors,
                               Messages, Quizzes, Courses, AskAI, Profile
supabase/migrations/         → versioned schema changes — see Database migrations above
```

## Security design (CIA triad)

Two authentication paths are supported — password and Google OAuth — and the
security decisions below apply to both, not just the login screen.

**Confidentiality** — only the right people can read the data
- Every table has row-level security. Students/tutors can only read messages in
  conversations they're a member of (`messages` policy), and only edit their own
  profile — enforced in Postgres, not just hidden in the UI.
- Google OAuth means no password is stored for those accounts at all — nothing to
  leak in a breach. Password accounts store only Supabase's salted hash, never
  plaintext.
- `.env` (which holds your Supabase keys) is git-ignored; the anon key is safe to
  expose client-side by design, but RLS is what actually protects the data behind it.

**Integrity** — data can't be silently corrupted or forged
- DB constraints stop bad data at the source: a quiz's `correct_index` must point at
  an option that actually exists (`correct_index_in_range`), and an attempt's `score`
  can never exceed its `total`.
- `updated_at` is stamped by a Postgres trigger, not sent by the client, so it can't
  be spoofed.
- Inserts are tied to `auth.uid()` in RLS policies (e.g. you can only send a message
  as yourself), so one user can't forge messages or attempts as another.

**Availability** — the app keeps working under normal failure conditions
- Auth, database, and realtime all run on Supabase's managed infrastructure rather
  than a single server you'd need to keep alive.
- Supabase rate-limits auth requests per email automatically, which also happens to
  blunt brute-force/spam attempts against login and signup.
- Every async action in the UI (login, sending a message, submitting a quiz) has a
  loading/disabled state and surfaces errors instead of failing silently, so a slow
  network degrades gracefully rather than leaving the user stuck.

## Observability

**Error tracking (Sentry)**: create a free React project at sentry.io, copy
its DSN into `VITE_SENTRY_DSN`. `main.jsx` wraps the whole app in
`Sentry.ErrorBoundary` and calls `Sentry.init` on load — leaving the DSN blank
disables it entirely rather than erroring, so it's safe to skip locally.

**Product analytics (Plausible, not PostHog)**: chosen specifically because
it's cookieless — no personal data collected, no consent banner needed, which
was the stated constraint. Sign up at plausible.io, add your deployed domain
as a site, and set `VITE_PLAUSIBLE_DOMAIN` to match exactly. The script tag in
`index.html` no-ops until that domain is real and matches what Plausible has
on file. Three custom events are already wired: `Signup`, `Message Sent`,
`Quiz Taken` (`src/lib/analytics.js`).

**Uptime monitoring (UptimeRobot)**: no code — create a free monitor at
uptimerobot.com pointed at your deployed frontend URL once Section 14 gives
you one. Nothing to do here until then.

## Testing

```bash
npm test          # runs once (used by CI)
npm run test:watch
```

Covers: the password-strength, quiz-scoring, and payment-status-label pure
functions (`src/lib/*.test.js`), the Signup flow end-to-end with a mocked
`useAuth` (role selection, validation gating, success/error paths), and
sending a message in `ChatWindow` with a mocked Supabase client. Note: this repo's
Vitest needed `pool: 'threads'` in `vite.config.js` — the default `forks`
pool hung indefinitely trying to spawn worker processes on this Windows
setup; threads worked immediately.

**RLS tests** (`tests/rls/`) run against a *real* local Supabase instance via
the Supabase CLI, not mocks — they're the only way to actually verify a
policy rejects what it should. They're skipped automatically (not failed) in
the default `npm test` run when the env vars below aren't set:
```bash
supabase start                # requires Docker; prints connection info when done
supabase status                # re-print that info any time
# from the output, set:
#   SUPABASE_LOCAL_URL, SUPABASE_LOCAL_ANON_KEY, SUPABASE_LOCAL_SERVICE_ROLE_KEY
npm run test:rls
```
Unlike the component tests above, `tests/rls/conversation_members.test.js` and
`tests/rls/courses.test.js` have **not been executed** in this environment (no
Docker available here) — they're written correctly against documented
Postgres/PostgREST error codes, but treat them as unverified until you
actually run them once.

**CI** (`.github/workflows/ci.yml`): runs `npm test` then `npm run build` on
every PR and every push to `main`. **This only activates once the project is
a git repository with a GitHub remote** — as of this section, it still isn't
(flagged three times over the course of building this out; the file is
written and harmless sitting on disk either way, but nothing will run it
until you `git init`, create a GitHub repo, and push). Add
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repo secrets (**Settings →
Secrets and variables → Actions**) for the build step to use your real values.

## Deployment

1. **Push to GitHub** (prerequisite for everything below — see the CI note above).
2. **Vercel or Netlify**, connected to that repo — both auto-detect a Vite
   app with zero config (build command `npm run build`, output dir `dist`).
   Either one also gives you a deploy preview + comment on every PR
   automatically, with no GitHub Actions config needed for that part
   specifically (separate from the test/build CI job above).
3. **Environment variables per environment**: set `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` (and the hCaptcha/Sentry/Plausible ones) in the
   platform's dashboard, scoped to Production vs. Preview if you want staging
   and production pointing at different Supabase projects — that split was
   raised back in the migrations section and never actually done; right now
   there's only the one Supabase project this whole app has been built against.
4. **Custom domain + HTTPS**: both platforms handle certificate provisioning
   automatically once you add a domain in their dashboard and point its DNS
   at them — no separate setup.

### Environment variables reference

Client (`.env`, also add to your hosting platform's dashboard):

| Variable | Required | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `VITE_HCAPTCHA_SITE_KEY` | No | Signup captcha widget (skipped if blank) |
| `VITE_SENTRY_DSN` | No | Error tracking (disabled if blank) |
| `VITE_PLAUSIBLE_DOMAIN` | No | Analytics (no-ops if blank/unmatched) |

Edge Function secrets (`supabase secrets set NAME=value` — never go in `.env`,
these run server-side only):

| Variable | Auto-provided? | Used by |
|---|---|---|
| `SUPABASE_URL` | Yes, always | every function |
| `SUPABASE_ANON_KEY` | Yes, always | every function that checks the caller's identity |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes, always | every function (privileged DB access) |
| `SENDGRID_API_KEY` | No | `send-notification-email`, `weekly-digest` |
| `SENDGRID_FROM_EMAIL` | No | same two |
| `UNSUBSCRIBE_SECRET` | No | same two, plus `unsubscribe` |
| `CRON_SECRET` | No | `weekly-digest`, `session-reminders` |
| `APP_URL` | No | `send-notification-email`, `create-payment` |
| `PAYSTACK_SECRET_KEY` | No | `create-payment`, `paystack-webhook`, `create-payout-recipient`, `release-payment` |
| `DAILY_API_KEY` | No | `create-video-room` |
| `GROQ_API_KEY` | No (optional for `moderate-message`; required for the other two) | `moderate-message`, `generate-quiz-questions`, `parse-resume` |

## Notes for extending this

- **Auto-generated quizzes**: after a chat session, send the transcript to an
  LLM and have it draft `quiz_questions` rows for a tutor to review before publishing.
- **Admin queue polish**: `/admin` covers pending verifications, open reports,
  and basic metrics — a bulk-action UI or filtering would help once volume grows.
- **Web Push**: notifications currently only reach an open tab (Realtime) or
  email — a service worker would let them land when the tab's closed.
  before a tutor is publicly listed.
