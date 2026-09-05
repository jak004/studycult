import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Field from './Field'

export default function PayoutsTab({ profile, refreshProfile }) {
  const [type, setType] = useState('mobile_money')
  const [bankName, setBankName] = useState('')
  const [bankCode, setBankCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    setSaved(false)
    const { data, error } = await supabase.functions.invoke('create-payout-recipient', {
      body: { type, bank_name: bankName, bank_code: bankCode, account_number: accountNumber },
    })
    setSaving(false)
    if (error || data?.error) {
      setError(data?.error || error.message)
      return
    }
    await refreshProfile()
    setSaved(true)
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-ink">Payout details</h1>
      <p className="mt-2 text-muted">
        Where your share of each session payment gets sent (via Paystack), once you mark a session completed.
      </p>

      {profile.paystack_recipient_code ? (
        <div className="mt-4 rounded-xl border border-line bg-teal-soft px-4 py-3 text-sm text-ink">
          Payouts go to {profile.payout_bank_name || 'your account'} ····{profile.payout_account_last4}.
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">No payout method set up yet.</p>
      )}

      <form onSubmit={handleSubmit} className="mt-5 flex flex-wrap items-end gap-3">
        <Field label="Type">
          <select value={type} onChange={(e) => setType(e.target.value)} className="input">
            <option value="mobile_money">Mobile Money</option>
            <option value="ghipss">Bank account</option>
          </select>
        </Field>
        <Field label={type === 'mobile_money' ? 'Network name' : 'Bank name'}>
          <input
            required
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            className="input"
            placeholder={type === 'mobile_money' ? 'MTN Mobile Money' : 'GCB Bank'}
          />
        </Field>
        <Field label="Bank/network code">
          <input
            required
            value={bankCode}
            onChange={(e) => setBankCode(e.target.value)}
            className="input"
            placeholder="See Paystack's list of Ghana banks"
          />
        </Field>
        <Field label={type === 'mobile_money' ? 'Phone number' : 'Account number'}>
          <input required value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="input" />
        </Field>
        <button type="submit" disabled={saving} className="btn btn-primary px-5 py-2.5 text-sm">
          {saving ? 'Saving…' : 'Save payout details'}
        </button>
      </form>
      <p className="mt-2 text-xs text-muted">
        Look up your bank or mobile money network's exact Paystack code from Paystack's Ghana bank list before
        submitting — an incorrect code will fail here with an error rather than silently doing the wrong thing.
      </p>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {saved && <p className="mt-2 text-sm text-teal">Payout details saved.</p>}
    </div>
  )
}
