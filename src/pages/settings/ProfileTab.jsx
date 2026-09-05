import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Field from './Field'
import { splitFullName } from '../../lib/names'

const EMOJIS = ['🎓', '📚', '🧠', '✏️', '🔬', '📐', '🌍', '🎨']

export default function ProfileTab({ profile, refreshProfile }) {
  // Accounts created before first/middle/last existed only have full_name —
  // split it once as a starting point so the fields aren't blank; nothing is
  // written back until Save is actually clicked.
  const fallbackName = splitFullName(profile.full_name)
  const [firstName, setFirstName] = useState(profile.first_name || fallbackName.firstName)
  const [middleName, setMiddleName] = useState(profile.middle_name || fallbackName.middleName)
  const [lastName, setLastName] = useState(profile.last_name || fallbackName.lastName)
  const [username, setUsername] = useState(profile.username || '')
  const [usernameError, setUsernameError] = useState('')
  const [bio, setBio] = useState(profile.bio || '')
  const [subjectsInput, setSubjectsInput] = useState((profile.subjects || []).join(', '))
  const [languagesInput, setLanguagesInput] = useState((profile.languages || []).join(', '))
  const [hourlyRate, setHourlyRate] = useState(profile.hourly_rate || '')
  const [pronouns, setPronouns] = useState(profile.preferred_pronouns || '')
  const [emoji, setEmoji] = useState(profile.avatar_emoji || '🎓')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [resumeState, setResumeState] = useState('idle') // idle | reading | done | error
  const [resumeError, setResumeError] = useState('')

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setUsernameError('')
    const subjects = subjectsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const languages = languagesInput
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean)

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName.trim(),
        middle_name: middleName.trim() || null,
        last_name: lastName.trim(),
        username: username.trim() || null,
        bio,
        subjects,
        languages,
        preferred_pronouns: pronouns || null,
        hourly_rate: hourlyRate ? Number(hourlyRate) : null,
        avatar_emoji: emoji,
      })
      .eq('id', profile.id)

    setSaving(false)
    if (error) {
      if (error.code === '23505') setUsernameError('That username is already taken — try another.')
      else setUsernameError(error.message)
      return
    }
    await refreshProfile()
    setSaved(true)
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setAvatarUploading(true)
    setAvatarError('')

    const ext = file.name.split('.').pop()
    const path = `${profile.id}/avatar.${ext}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadError) {
      setAvatarError(uploadError.message)
      setAvatarUploading(false)
      return
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_url: `${data.publicUrl}?v=${Date.now()}` }).eq('id', profile.id)
    await refreshProfile()
    setAvatarUploading(false)
  }

  async function handleResumeUpload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setResumeError('')
    setResumeState('reading')
    try {
      // Loaded on demand — see the same note in Quizzes.jsx's slide upload.
      const { extractPdfText } = await import('../../lib/pdf')
      const text = await extractPdfText(file)
      const { data, error } = await supabase.functions.invoke('parse-resume', { body: { text } })
      if (error || data?.error) throw new Error(data?.error || error.message)

      if (data.bio) setBio(data.bio)
      if (data.subjects?.length) setSubjectsInput(data.subjects.join(', '))
      if (data.languages?.length) setLanguagesInput(data.languages.join(', '))
      setResumeState('done')
    } catch (err) {
      setResumeError(err.message)
      setResumeState('error')
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-ink">Profile</h1>
      <p className="mt-2 text-muted">
        {profile.role === 'tutor'
          ? 'This is what students see when browsing tutors.'
          : 'Tutors and study room members will see your name and avatar.'}
      </p>

      {profile.role === 'tutor' && (
        <div className="mt-6 rounded-xl border border-dashed border-line p-4">
          <p className="text-sm font-medium text-ink-soft">Start from your resume/CV</p>
          <p className="mt-1 text-xs text-muted">
            Upload a PDF resume — AI drafts your bio, subjects, and languages below for you to review and edit
            before saving. Nothing is saved until you click Save changes.
          </p>
          <label className="mt-3 inline-block cursor-pointer rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:border-teal hover:text-teal">
            {resumeState === 'reading' ? 'Reading & drafting…' : '📄 Upload Resume/CV (PDF)'}
            <input
              type="file"
              accept="application/pdf"
              onChange={handleResumeUpload}
              className="hidden"
              disabled={resumeState === 'reading'}
            />
          </label>
          {resumeState === 'done' && <p className="mt-2 text-sm text-teal">Drafted below — review, then Save changes.</p>}
          {resumeError && <p className="mt-2 text-sm text-danger">{resumeError}</p>}
        </div>
      )}

      <form onSubmit={handleSave} className="mt-6 flex flex-col gap-5">
        <div>
          <p className="mb-2 text-sm font-medium text-ink-soft">Avatar</p>
          <div className="flex flex-wrap items-center gap-3">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Your avatar" className="h-11 w-11 rounded-full object-cover" />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-soft text-xl">
                {emoji}
              </span>
            )}
            <label className="cursor-pointer rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:border-ink/30">
              {avatarUploading ? 'Uploading…' : 'Upload photo'}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={avatarUploading}
              />
            </label>
          </div>
          {avatarError && <p className="mt-1 text-sm text-danger">{avatarError}</p>}

          <p className="mb-2 mt-4 text-xs text-muted">Or pick an emoji fallback (used if you haven't uploaded a photo):</p>
          <div className="flex gap-2">
            {EMOJIS.map((e) => (
              <button
                type="button"
                key={e}
                onClick={() => setEmoji(e)}
                className={`h-11 w-11 rounded-full border text-xl ${
                  emoji === e ? 'border-teal bg-teal-soft' : 'border-line bg-paper-raised'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name">
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input" required />
          </Field>
          <Field label="Surname">
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="input" required />
          </Field>
        </div>
        <Field label="Middle name (optional)">
          <input value={middleName} onChange={(e) => setMiddleName(e.target.value)} className="input" />
        </Field>

        {profile.role === 'student' && (
          <Field label="Username (optional)">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
              placeholder="e.g. ama_studies"
            />
            <p className="mt-1 text-xs text-muted">
              Shown to other students instead of your real name — on Peers and in group study rooms. Tutors always
              see your real name. Leave blank to just use your name everywhere.
            </p>
          </Field>
        )}
        {usernameError && <p className="text-sm text-danger">{usernameError}</p>}

        <Field label="Preferred pronouns">
          <input
            value={pronouns}
            onChange={(e) => setPronouns(e.target.value)}
            className="input"
            placeholder="she/her, he/him, they/them…"
          />
        </Field>

        <Field label="Bio">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="input min-h-24"
            placeholder={profile.role === 'tutor' ? 'What do you teach and how?' : 'A short line about you.'}
          />
        </Field>

        <Field label="Subjects (comma separated)">
          <input
            value={subjectsInput}
            onChange={(e) => setSubjectsInput(e.target.value)}
            className="input"
            placeholder="Mathematics, Physics"
          />
        </Field>

        <Field label="Languages you teach in (comma separated)">
          <input
            value={languagesInput}
            onChange={(e) => setLanguagesInput(e.target.value)}
            className="input"
            placeholder="English, Twi, French"
          />
        </Field>

        {profile.role === 'tutor' && (
          <Field label="Hourly rate (GHS)">
            <input
              type="number"
              min="0"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              className="input"
              placeholder="60"
            />
          </Field>
        )}

        <button type="submit" disabled={saving} className="btn btn-primary mt-2 self-start px-6 py-3 text-sm">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {saved && <p className="text-sm text-teal">Saved.</p>}
      </form>
    </div>
  )
}
