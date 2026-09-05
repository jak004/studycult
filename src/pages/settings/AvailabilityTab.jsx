import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { getBrowserTimezone } from '../../lib/timezone'
import Field from './Field'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function AvailabilityTab({ tutorId }) {
  const [slots, setSlots] = useState([])
  const [selectedDays, setSelectedDays] = useState(() => new Set([1]))
  const [startTime, setStartTime] = useState('16:00')
  const [endTime, setEndTime] = useState('17:00')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [lastClickedDay, setLastClickedDay] = useState(null)
  const timezone = getBrowserTimezone()

  // Click a day to toggle just that one; shift-click another to select the
  // whole range between it and the last day you clicked — e.g. click Monday,
  // shift-click Wednesday, and Mon/Tue/Wed are all selected at once.
  function handleDayClick(i, shiftKey) {
    if (shiftKey && lastClickedDay !== null) {
      const [lo, hi] = lastClickedDay <= i ? [lastClickedDay, i] : [i, lastClickedDay]
      setSelectedDays((prev) => {
        const next = new Set(prev)
        for (let d = lo; d <= hi; d++) next.add(d)
        return next
      })
    } else {
      setSelectedDays((prev) => {
        const next = new Set(prev)
        if (next.has(i)) next.delete(i)
        else next.add(i)
        return next
      })
    }
    setLastClickedDay(i)
  }

  async function load() {
    const { data } = await supabase
      .from('tutor_availability')
      .select('*')
      .eq('tutor_id', tutorId)
      .order('weekday', { ascending: true })
    setSlots(data || [])
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorId])

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (selectedDays.size === 0) {
      setError('Pick at least one day.')
      return
    }
    if (startTime >= endTime) {
      setError('End time must be after start time.')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('tutor_availability').insert(
      Array.from(selectedDays).map((weekday) => ({
        tutor_id: tutorId,
        weekday,
        start_time: startTime,
        end_time: endTime,
        timezone,
      }))
    )
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    await load()
  }

  async function handleRemove(id) {
    await supabase.from('tutor_availability').delete().eq('id', id)
    await load()
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-ink">Weekly availability</h1>
      <p className="mt-2 text-muted">
        Students book against these recurring weekly slots, shown to them in their own local time.
      </p>

      <div className="mt-6 flex flex-col gap-2">
        {slots.length === 0 && <p className="text-sm text-muted">No availability set yet.</p>}
        {slots.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-xl border border-line px-4 py-2.5">
            <span className="text-sm text-ink-soft">
              {WEEKDAYS[s.weekday]} · {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)} ({s.timezone})
            </span>
            <button onClick={() => handleRemove(s.id)} className="text-sm text-danger hover:underline">
              Remove
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} className="mt-5 flex flex-col gap-3">
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-soft">Days</p>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((label, i) => (
              <button
                type="button"
                key={i}
                onClick={(e) => handleDayClick(i, e.shiftKey)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedDays.has(i) ? 'border-ink bg-ink text-paper' : 'border-line text-ink-soft hover:border-ink/40'
                }`}
              >
                {label.slice(0, 3)}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">Click to toggle a day, or shift-click another to select the range between them.</p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Field label="Start">
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input" />
          </Field>
          <Field label="End">
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input" />
          </Field>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary px-5 py-2.5 text-sm"
          >
            {saving
              ? 'Adding…'
              : `+ Add ${selectedDays.size > 1 ? `${selectedDays.size} slots` : 'slot'}`}
          </button>
        </div>
      </form>
      <p className="mt-2 text-xs text-muted">Times use your detected timezone: {timezone}.</p>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  )
}
