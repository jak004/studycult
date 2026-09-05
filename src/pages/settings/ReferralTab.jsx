import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function ReferralTab({ profile }) {
  const [count, setCount] = useState(0)
  const [copied, setCopied] = useState(false)

  const referralUrl = `${window.location.origin}/signup?ref=${profile.id}`

  useEffect(() => {
    async function load() {
      const { count } = await supabase
        .from('referrals')
        .select('id', { count: 'exact', head: true })
        .eq('referrer_id', profile.id)
      setCount(count || 0)
    }
    load()
  }, [profile.id])

  async function copyLink() {
    await navigator.clipboard.writeText(referralUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join me on StudyCult', url: referralUrl })
      } catch {
        // User closed the share sheet without picking anything — nothing to do.
      }
    } else {
      copyLink()
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-ink">Refer a friend</h1>
      <p className="mt-2 text-muted">
        Share your link — anyone who signs up through it is credited to you here. This tracks who you brought in
        without an attached reward for now; what the reward actually is (credit, a discount, something else) is a
        real product decision worth making deliberately rather than guessing at.
      </p>

      <div className="mt-6 rounded-2xl bg-gold-soft p-6">
        <div className="flex flex-wrap items-center gap-2">
          <input
            readOnly
            value={referralUrl}
            onFocus={(e) => e.target.select()}
            className="input min-w-[200px] flex-1"
          />
          <button onClick={copyLink} className="btn btn-outline bg-paper-raised px-4 py-2 text-sm">
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button onClick={share} className="btn btn-primary px-4 py-2 text-sm">
            Share
          </button>
        </div>
        <p className="mt-3 text-xs text-ink-soft">
          Only tracked for people who sign up with a password — Google sign-ins don't carry the referral through.
        </p>
      </div>

      <div className="card mt-6 p-6">
        <p className="text-sm font-medium text-muted">Successful referrals</p>
        <p className="mt-2 font-display text-4xl font-semibold text-ink">{count}</p>
      </div>
    </div>
  )
}
