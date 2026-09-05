export function joinNameParts(first, middle, last) {
  return [first, middle, last]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join(' ')
}

// Best-effort only, for pre-filling the First/Middle/Last fields on Profile
// for accounts created before those columns existed (they only have
// full_name) — never written back automatically, only used to seed the form.
export function splitFullName(fullName = '') {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', middleName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], middleName: '', lastName: '' }
  return {
    firstName: parts[0],
    lastName: parts[parts.length - 1],
    middleName: parts.slice(1, -1).join(' '),
  }
}

// A student can set a username shown to other students (peers, group study
// rooms) instead of their real name. It never applies to a tutor's own name
// (already public on their listing) or when the viewer IS a tutor — tutors
// always see a student's real full_name, e.g. in 1:1 session chat.
export function displayName(target, viewerRole) {
  if (!target) return 'Someone'
  if (target.role !== 'student') return target.full_name || 'Someone'
  if (viewerRole === 'tutor') return target.full_name || 'Someone'
  return target.username || target.full_name || 'Someone'
}
