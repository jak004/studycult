// Runs only against a local Supabase stack (`supabase start`), never as part
// of the default `npm test` — see `npm run test:rls` and the README's
// "Testing" section for the three env vars this needs (from `supabase
// status`). NOTE: like tests/rls/conversation_members.test.js, this has not
// been executed against a real instance in this environment (no Docker
// available) — it's written correctly against documented Postgres/PostgREST
// behavior (42501 = insufficient_privilege for an RLS rejection), but treat
// it as unverified until you run it once.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const LOCAL_URL = process.env.SUPABASE_LOCAL_URL
const ANON_KEY = process.env.SUPABASE_LOCAL_ANON_KEY
const SERVICE_ROLE_KEY = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY
const hasLocalStack = Boolean(LOCAL_URL && ANON_KEY && SERVICE_ROLE_KEY)

describe.skipIf(!hasLocalStack)('RLS: courses, course_materials, course_enrollments', () => {
  let admin
  const password = 'CorrectHorse1!'
  let tutorA
  let tutorB
  let student
  let courseId

  async function createSignedInUser(label, role) {
    const email = `rls-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `RLS ${label}`, role },
    })
    if (error) throw error

    const client = createClient(LOCAL_URL, ANON_KEY)
    const { error: signInError } = await client.auth.signInWithPassword({ email, password })
    if (signInError) throw signInError

    return { id: data.user.id, client }
  }

  beforeAll(async () => {
    admin = createClient(LOCAL_URL, SERVICE_ROLE_KEY)
    tutorA = await createSignedInUser('tutor-a', 'tutor')
    tutorB = await createSignedInUser('tutor-b', 'tutor')
    student = await createSignedInUser('student', 'student')

    const { data: course, error } = await admin
      .from('courses')
      .insert({ tutor_id: tutorA.id, title: 'RLS Test Course', subject: 'Testing' })
      .select()
      .single()
    if (error) throw error
    courseId = course.id
  })

  afterAll(async () => {
    if (courseId) await admin.from('courses').delete().eq('id', courseId)
    if (tutorA) await admin.auth.admin.deleteUser(tutorA.id)
    if (tutorB) await admin.auth.admin.deleteUser(tutorB.id)
    if (student) await admin.auth.admin.deleteUser(student.id)
  })

  it('lets any signed-in user read a course, not just its owner', async () => {
    const { data, error } = await student.client.from('courses').select('*').eq('id', courseId).single()
    expect(error).toBeNull()
    expect(data.title).toBe('RLS Test Course')
  })

  it('blocks a student from creating a course', async () => {
    const { error } = await student.client
      .from('courses')
      .insert({ tutor_id: student.id, title: 'Should not exist', subject: 'Testing' })
    expect(error?.code).toBe('42501')
  })

  it("silently affects zero rows when a tutor tries to delete another tutor's course", async () => {
    await tutorB.client.from('courses').delete().eq('id', courseId)
    const { data } = await admin.from('courses').select('id').eq('id', courseId).single()
    expect(data?.id).toBe(courseId)
  })

  it("blocks a non-owner tutor from adding materials to someone else's course", async () => {
    const { error } = await tutorB.client
      .from('course_materials')
      .insert({ course_id: courseId, title: 'Sneaky material', extracted_text: 'nope' })
    expect(error?.code).toBe('42501')
  })

  it('lets the owning tutor add materials to their own course', async () => {
    const { error } = await tutorA.client
      .from('course_materials')
      .insert({ course_id: courseId, title: 'Legit material', extracted_text: 'ok' })
    expect(error).toBeNull()
  })

  it('blocks a student from enrolling someone else in a course', async () => {
    const { error } = await student.client
      .from('course_enrollments')
      .insert({ course_id: courseId, student_id: tutorB.id })
    expect(error?.code).toBe('42501')
  })

  it('lets a student enroll themselves', async () => {
    const { error } = await student.client.from('course_enrollments').insert({ course_id: courseId, student_id: student.id })
    expect(error).toBeNull()
  })
})
