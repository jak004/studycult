import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { getOrCreateDirectConversation } from '../lib/conversations'
import CoverArt from '../components/CoverArt'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Rating from '../components/ui/Rating'
import { CheckBadgeIcon, SearchIcon } from '../components/ui/icons'
import { initials } from '../lib/format'
import { formatInViewerTimezone } from '../lib/timezone'
import { generateUpcomingSlots } from '../lib/availability'

const RATING_OPTIONS = [
  { label: 'Any rating', value: 0 },
  { label: '3.0 & up', value: 3 },
  { label: '4.0 & up', value: 4 },
  { label: '4.5 & up', value: 4.5 },
]

export default function Tutors() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [tutors, setTutors] = useState([])
  const [loading, setLoading] = useState(true)
  const [subjectFilter, setSubjectFilter] = useState('All')
  const [startingId, setStartingId] = useState(null)
  const [startError, setStartError] = useState('')
  const [bookingTutor, setBookingTutor] = useState(null)
  const [ratings, setRatings] = useState({})
  const [availableTodayIds, setAvailableTodayIds] = useState(new Set())

  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '')
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('q') || '')
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

  const subjectCounts = useMemo(() => {
    const counts = {}
    tutors.forEach((t) => (t.subjects || []).forEach((s) => (counts[s] = (counts[s] || 0) + 1)))
    return counts
  }, [tutors])

  const subjects = useMemo(
    () => Object.keys(subjectCounts).sort((a, b) => subjectCounts[b] - subjectCounts[a]),
    [subjectCounts]
  )

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
    <div className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="text-3xl font-black text-ink">Find a tutor</h1>
      <p className="mt-1.5 max-w-xl text-muted">
        Search by subject, bio, or teaching style — no booking form required to start a chat.
      </p>

      <label className="relative mt-6 block max-w-xl">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search tutors, e.g. 'calculus exam prep'"
          className="input w-full py-2.5 pl-10"
        />
      </label>

      {startError && <p className="mt-4 text-sm text-danger">{startError}</p>}

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start">
        <aside className="shrink-0 lg:w-64">
          <Card className="divide-y divide-line">
            <FilterSection title="Subject">
              <FacetRow label="All subjects" active={subjectFilter === 'All'} onClick={() => setSubjectFilter('All')} count={tutors.length} />
              {subjects.map((s) => (
                <FacetRow key={s} label={s} active={subjectFilter === s} onClick={() => setSubjectFilter(s)} count={subjectCounts[s]} />
              ))}
            </FilterSection>

            <FilterSection title="Rating">
              {RATING_OPTIONS.map((o) => (
                <FacetRow key={o.value} label={o.label} active={minRating === o.value} onClick={() => setMinRating(o.value)} />
              ))}
            </FilterSection>

            <FilterSection title="Price per hour">
              <div className="flex items-center gap-2 px-4 py-3">
                <input
                  type="number"
                  min="0"
                  aria-label="Minimum price"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="Min"
                  className="input w-full py-1.5 text-sm"
                />
                <span className="text-muted">–</span>
                <input
                  type="number"
                  min="0"
                  aria-label="Maximum price"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Max"
                  className="input w-full py-1.5 text-sm"
                />
              </div>
            </FilterSection>

            <FilterSection title="Language">
              <div className="px-4 py-3">
                <select value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)} className="input w-full py-1.5 text-sm">
                  {languages.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </FilterSection>

            <div className="px-4 py-3">
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={availableTodayOnly}
                  onChange={(e) => setAvailableTodayOnly(e.target.checked)}
                />
                Available today
              </label>
            </div>
          </Card>
        </aside>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-soft">
            {loading ? 'Loading…' : `${filtered.length} tutor${filtered.length === 1 ? '' : 's'}`}
          </p>

          {loading ? (
            <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-md border border-line bg-paper-raised">
                  <div className="aspect-video w-full bg-paper" />
                  <div className="space-y-2 p-4">
                    <div className="h-4 w-2/3 rounded bg-paper" />
                    <div className="h-3 w-full rounded bg-paper" />
                    <div className="h-3 w-1/2 rounded bg-paper" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="mt-4 p-8 text-center">
              <p className="font-semibold text-ink">No tutors match those filters.</p>
              <p className="mt-1 text-sm text-muted">Try widening your search or clearing a filter.</p>
            </Card>
          ) : (
            <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((tutor) => {
                const rating = ratings[tutor.id]
                const availableToday = availableTodayIds.has(tutor.id)
                return (
                  <Card key={tutor.id} interactive className="flex flex-col overflow-hidden">
                    <div className="aspect-video w-full border-b border-line">
                      <CoverArt seed={tutor.subjects?.[0] || tutor.full_name} className="h-full w-full" />
                    </div>

                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex items-center gap-2">
                        {tutor.avatar_url ? (
                          <img src={tutor.avatar_url} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-paper">
                            {initials(tutor.full_name)}
                          </span>
                        )}
                        <p className="truncate text-base font-bold leading-tight text-ink">{tutor.full_name}</p>
                        {tutor.verification_status === 'verified' && (
                          <CheckBadgeIcon className="h-4 w-4 shrink-0 text-primary" aria-label="Verified tutor" />
                        )}
                      </div>

                      {tutor.bio && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{tutor.bio}</p>}

                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Rating value={rating?.avg} count={rating?.count} />
                        {tutor.hourly_rate != null && (
                          <span className="text-sm font-bold text-ink">₵{tutor.hourly_rate}/hr</span>
                        )}
                      </div>

                      {(tutor.subjects || []).length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {tutor.subjects.slice(0, 4).map((s) => (
                            <Badge key={s}>{s}</Badge>
                          ))}
                        </div>
                      )}

                      {availableToday && (
                        <Badge variant="success" className="mt-2.5 self-start">
                          Available today
                        </Badge>
                      )}

                      <div className="mt-4 flex gap-2 border-t border-line pt-3">
                        <Button onClick={() => messageTutor(tutor)} disabled={startingId === tutor.id} size="sm" className="flex-1">
                          {startingId === tutor.id ? 'Opening chat…' : 'Message'}
                        </Button>
                        <Button onClick={() => setBookingTutor(tutor)} variant="outline" size="sm" className="flex-1">
                          Book
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>

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

function FilterSection({ title, children }) {
  return (
    <div className="py-3 first:pt-4 last:pb-4">
      <p className="px-4 pb-2 text-xs font-bold uppercase tracking-wide text-muted">{title}</p>
      {children}
    </div>
  )
}

function FacetRow({ label, active, onClick, count }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between px-4 py-1.5 text-left text-sm transition-colors ${
        active ? 'font-bold text-primary' : 'text-ink-soft hover:text-ink'
      }`}
    >
      <span className="truncate">{label}</span>
      {count != null && <span className="ml-2 shrink-0 text-xs text-muted">{count}</span>}
    </button>
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
      <Card className="w-full max-w-md p-6">
        {done ? (
          <div className="text-center">
            <p className="text-xl font-bold text-ink">Request sent</p>
            <p className="mt-2 text-sm text-muted">
              {tutor.full_name} will confirm your session for {formatInViewerTimezone(selected.scheduled_at)}.
            </p>
            <Button onClick={onClose} className="mt-5">
              Done
            </Button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-ink">Book {tutor.full_name}</h2>
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
                    className={`rounded border px-4 py-2.5 text-left text-sm transition-colors ${
                      selected?.key === slot.key ? 'border-primary bg-primary-soft' : 'border-line hover:border-ink/30'
                    }`}
                  >
                    {formatInViewerTimezone(slot.scheduled_at)}
                  </button>
                ))
              )}
            </div>

            {error && <p className="mt-3 text-sm text-danger">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={onClose} variant="ghost">
                Cancel
              </Button>
              <Button onClick={confirmBooking} disabled={!selected || booking}>
                {booking ? 'Booking…' : 'Request session'}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
