import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { getOrCreateDirectConversation } from '../lib/conversations'
import CoverArt from '../components/CoverArt'
import { initials } from '../lib/format'
import { formatInViewerTimezone } from '../lib/timezone'
import { generateUpcomingSlots } from '../lib/availability'

const RATING_OPTIONS = [
  { label: 'Any rating', value: 0 },
  { label: '3+ stars', value: 3 },
  { label: '4+ stars', value: 4 },
  { label: '4.5+ stars', value: 4.5 },
]

export default function Tutors() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [tutors, setTutors] = useState([])
  const [loading, setLoading] = useState(true)
  const [subjectFilter, setSubjectFilter] = useState('All')
  const [startingId, setStartingId] = useState(null)
  const [startError, setStartError] = useState('')
  const [bookingTutor, setBookingTutor] = useState(null)
  const [ratings, setRatings] = useState({})
  const [availableTodayIds, setAvailableTodayIds] = useState(new Set())

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [languageFilter, setLanguageFilter] = useState('All')
  const [minRating, setMinRating] = useState(0)
  const [availableTodayOnly, setAvailableTodayOnly] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    async function load() {
      setLoading(true)
      let query = supabase.from('profiles').select('*').eq('role', 'tutor')
      if (debouncedSearch.trim()) {
        query = query.textSearch('search_vector', debouncedSearch.trim(), { type: 'websearch', config: 'english' })
      }
      if (minPrice) query = query.gte('hourly_rate', Number(minPrice))
      if (maxPrice) query = query.lte('hourly_rate', Number(maxPrice))
      if (languageFilter !== 'All') query = query.contains('languages', [languageFilter])

      const { data } = await query
      const tutorList = data || []
      setTutors(tutorList)
      setLoading(false)

      const tutorIds = tutorList.map((t) => t.id)
      if (tutorIds.length === 0) {
        setRatings({})
        setAvailableTodayIds(new Set())
        return
      }

      const [{ data: reviews }, { data: availRows }] = await Promise.all([
        supabase.from('reviews').select('reviewee_id, rating').in('reviewee_id', tutorIds),
        supabase.from('tutor_availability').select('*').in('tutor_id', tutorIds),
      ])

      const byTutor = {}
      ;(reviews || []).forEach((r) => {
        byTutor[r.reviewee_id] = byTutor[r.reviewee_id] || []
        byTutor[r.reviewee_id].push(r.rating)
      })
      const summary = {}
      Object.entries(byTutor).forEach(([id, list]) => {
        summary[id] = { avg: list.reduce((a, b) => a + b, 0) / list.length, count: list.length }
      })
      setRatings(summary)

      const rowsByTutor = {}
      ;(availRows || []).forEach((row) => {
        rowsByTutor[row.tutor_id] = rowsByTutor[row.tutor_id] || []
        rowsByTutor[row.tutor_id].push(row)
      })
      const todaySet = new Set()
      Object.entries(rowsByTutor).forEach(([tutorId, rows]) => {
        const slots = generateUpcomingSlots(rows, 1)
        const withinADay = slots.some((s) => s.scheduled_at.getTime() - Date.now() < 24 * 60 * 60 * 1000)
        if (withinADay) todaySet.add(tutorId)
      })
      setAvailableTodayIds(todaySet)
    }
    load()
  }, [debouncedSearch, minPrice, maxPrice, languageFilter])

  const subjects = useMemo(() => {
    const set = new Set()
    tutors.forEach((t) => (t.subjects || []).forEach((s) => set.add(s)))
    return ['All', ...Array.from(set)]
  }, [tutors])

  const languages = useMemo(() => {
    const set = new Set()
    tutors.forEach((t) => (t.languages || []).forEach((l) => set.add(l)))
    return ['All', ...Array.from(set)]
  }, [tutors])

  const filtered = tutors.filter((t) => {
    if (subjectFilter !== 'All' && !(t.subjects || []).includes(subjectFilter)) return false
    if (minRating > 0 && (!ratings[t.id] || ratings[t.id].avg < minRating)) return false
    if (availableTodayOnly && !availableTodayIds.has(t.id)) return false
    return true
  })

  async function messageTutor(tutor) {
    if (!profile) return
    setStartingId(tutor.id)
    setStartError('')
    try {
      const convo = await getOrCreateDirectConversation(profile.id, tutor.id)
      navigate(`/messages?c=${convo.id}`)
    } catch (err) {
      setStartError(`Couldn't start a chat with ${tutor.full_name}: ${err.message}`)
    } finally {
      setStartingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="font-display text-4xl font-semibold text-ink">Find a tutor</h1>
      <p className="mt-2 max-w-lg text-muted">
        Search by subject, bio, or teaching style — no booking form required to start a chat.
      </p>

      <input
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Search tutors, e.g. 'calculus exam prep'"
        className="input mt-6 w-full max-w-lg"
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {subjects.map((s) => (
          <button
            key={s}
            onClick={() => setSubjectFilter(s)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              subjectFilter === s
                ? 'border-ink bg-ink text-paper'
                : 'border-line bg-paper-raised text-ink-soft hover:border-ink/40'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-soft">Min ₵/hr</span>
          <input
            type="number"
            min="0"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="input w-24"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-soft">Max ₵/hr</span>
          <input
            type="number"
            min="0"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="input w-24"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-soft">Language</span>
          <select value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)} className="input">
            {languages.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-soft">Rating</span>
          <select
            value={minRating}
            onChange={(e) => setMinRating(Number(e.target.value))}
            className="input"
          >
            {RATING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2.5 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={availableTodayOnly}
            onChange={(e) => setAvailableTodayOnly(e.target.checked)}
          />
          Available today
        </label>
      </div>

      {startError && <p className="mt-4 text-sm text-danger">{startError}</p>}

      {loading ? (
        <p className="mt-10 text-sm text-muted">Loading tutors…</p>
      ) : filtered.length === 0 ? (
        <div className="mt-10 card p-8 text-center">
          <p className="text-ink-soft">No tutors match those filters.</p>
          <p className="mt-1 text-sm text-muted">Try widening your search or clearing a filter.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tutor) => (
            <div key={tutor.id} className="card flex flex-col overflow-hidden">
              <div className="relative h-20">
                <CoverArt seed={tutor.subjects?.[0] || tutor.full_name} className="h-full w-full" />
                {tutor.avatar_url ? (
                  <img
                    src={tutor.avatar_url}
                    alt={tutor.full_name}
                    className="absolute -bottom-6 left-5 h-14 w-14 rounded-full border-4 border-paper-raised object-cover"
                  />
                ) : (
                  <div className="absolute -bottom-6 left-5 flex h-14 w-14 items-center justify-center rounded-full border-4 border-paper-raised bg-ink text-lg font-semibold text-paper">
                    {initials(tutor.full_name)}
                  </div>
                )}
                <span className="absolute right-3 top-3 text-xl drop-shadow">{tutor.avatar_emoji || '🎓'}</span>
              </div>

              <div className="flex flex-1 flex-col p-5 pt-8">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-display text-lg font-medium text-ink">{tutor.full_name}</p>
                    {tutor.verification_status === 'verified' && (
                      <span title="Verified tutor" className="text-teal">
                        ✅
                      </span>
                    )}
                    {availableTodayIds.has(tutor.id) && (
                      <span className="rounded-full bg-teal-soft px-2 py-0.5 text-[10px] font-medium text-teal">
                        Available today
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {tutor.hourly_rate && <p className="text-xs text-muted">₵{tutor.hourly_rate}/hr</p>}
                    {ratings[tutor.id] && (
                      <p className="text-xs text-muted">
                        ⭐ {ratings[tutor.id].avg.toFixed(1)} ({ratings[tutor.id].count})
                      </p>
                    )}
                  </div>
                </div>

                {tutor.bio && <p className="mt-3 text-sm leading-relaxed text-muted">{tutor.bio}</p>}

                {(tutor.subjects || []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tutor.subjects.map((s) => (
                      <span key={s} className="rounded-full bg-teal-soft px-2.5 py-1 text-xs font-medium text-ink">
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-5 flex gap-2">
                  <button
                    onClick={() => messageTutor(tutor)}
                    disabled={startingId === tutor.id}
                    className="btn btn-primary flex-1 px-4 py-2.5 text-sm"
                  >
                    {startingId === tutor.id ? 'Opening chat…' : 'Message'}
                  </button>
                  <button onClick={() => setBookingTutor(tutor)} className="btn btn-outline flex-1 px-4 py-2.5 text-sm">
                    Book
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {bookingTutor && (
        <BookingModal
          tutor={bookingTutor}
          myId={profile?.id}
          myName={profile?.full_name}
          onClose={() => setBookingTutor(null)}
        />
      )}
    </div>
  )
}

function BookingModal({ tutor, myId, myName, onClose }) {
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [booking, setBooking] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('tutor_availability').select('*').eq('tutor_id', tutor.id)
      setSlots(generateUpcomingSlots(data || []))
      setLoading(false)
    }
    load()
  }, [tutor.id])

  async function confirmBooking() {
    if (!selected || !myId) return
    setBooking(true)
    setError('')
    try {
      const conversation = await getOrCreateDirectConversation(myId, tutor.id)

      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          tutor_id: tutor.id,
          student_id: myId,
          scheduled_at: selected.scheduled_at.toISOString(),
          duration_minutes: selected.duration_minutes,
          timezone: selected.timezone,
          conversation_id: conversation.id,
        })
        .select()
        .single()

      if (sessionError) throw sessionError

      await supabase.from('events').insert({
        user_id: tutor.id,
        type: 'session_booked',
        payload: {
          session_id: session.id,
          other_name: myName || 'A student',
          when_text: formatInViewerTimezone(selected.scheduled_at),
        },
      })

      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBooking(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6">
      <div className="card w-full max-w-md p-6">
        {done ? (
          <div className="text-center">
            <p className="font-display text-xl font-medium text-ink">Request sent 🎉</p>
            <p className="mt-2 text-sm text-muted">
              {tutor.full_name} will confirm your session for {formatInViewerTimezone(selected.scheduled_at)}.
            </p>
            <button onClick={onClose} className="btn btn-primary mt-5 px-5 py-2.5 text-sm">
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 className="font-display text-xl font-medium text-ink">Book {tutor.full_name}</h2>
            <p className="mt-1 text-sm text-muted">Times shown in your local timezone.</p>

            <div className="mt-4 flex max-h-72 flex-col gap-2 overflow-y-auto">
              {loading ? (
                <p className="text-sm text-muted">Loading availability…</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted">This tutor hasn't set any availability yet.</p>
              ) : (
                slots.map((slot) => (
                  <button
                    key={slot.key}
                    onClick={() => setSelected(slot)}
                    className={`rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${
                      selected?.key === slot.key ? 'border-teal bg-teal-soft' : 'border-line hover:border-ink/30'
                    }`}
                  >
                    {formatInViewerTimezone(slot.scheduled_at)}
                  </button>
                ))
              )}
            </div>

            {error && <p className="mt-3 text-sm text-danger">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-medium text-muted">
                Cancel
              </button>
              <button onClick={confirmBooking} disabled={!selected || booking} className="btn btn-primary px-5 py-2.5 text-sm">
                {booking ? 'Booking…' : 'Request session'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
