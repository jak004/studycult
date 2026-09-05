import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function VerificationTab({ profile, refreshProfile }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleUpload(e) {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setError('')

    const path = `${profile.id}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('verification-documents').upload(path, file)
    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    await supabase.from('profiles').update({ verification_status: 'pending' }).eq('id', profile.id)
    await refreshProfile()
    setUploading(false)
    setFile(null)
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-ink">Get verified</h1>
      <p className="mt-2 text-muted">
        Upload an ID or teaching credential. Verified tutors get a badge students can see — it's kept private,
        visible only to you and reviewers.
      </p>

      <div className="mt-4">
        {profile.verification_status === 'verified' && <p className="text-sm font-medium text-teal">✅ You're verified.</p>}
        {profile.verification_status === 'pending' && <p className="text-sm text-muted">Your document is under review.</p>}
        {profile.verification_status === 'unverified' && <p className="text-sm text-muted">Not verified yet.</p>}
      </div>

      {profile.verification_status !== 'verified' && (
        <form onSubmit={handleUpload} className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-sm"
          />
          <button type="submit" disabled={!file || uploading} className="btn btn-primary px-5 py-2.5 text-sm">
            {uploading ? 'Uploading…' : 'Submit for review'}
          </button>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  )
}
