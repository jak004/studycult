// Admin-only. Populates (or tears down) a small set of realistic demo
// accounts, courses, sessions, and quiz history so a live walkthrough shows
// a lived-in app rather than an empty database. Every demo account's email
// ends in @studycult.demo, which is how cleanup finds them again — nothing
// here ever touches a real user.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight } from '../_shared/cors.ts'

const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const DEMO_DOMAIN = 'studycult.demo'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function requireAdmin(req: Request) {
  const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const {
    data: { user },
  } = await anonClient.auth.getUser()
  if (!user) return null
  const { data: profile } = await serviceClient.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? user : null
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString()
}

function daysFromNow(n: number) {
  return new Date(Date.now() + n * 86400000).toISOString()
}

async function findDemoUserIds(): Promise<string[]> {
  const { data, error } = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  return data.users.filter((u) => u.email?.endsWith(`@${DEMO_DOMAIN}`)).map((u) => u.id)
}

async function cleanup() {
  const demoUserIds = await findDemoUserIds()
  if (demoUserIds.length === 0) return { removed: 0 }

  const { data: courses } = await serviceClient.from('courses').select('id').in('tutor_id', demoUserIds)
  const courseIds = (courses ?? []).map((c) => c.id)

  const { data: quizzes } = await serviceClient
    .from('quizzes')
    .select('id')
    .or([`created_by.in.(${demoUserIds.join(',')})`, courseIds.length ? `course_id.in.(${courseIds.join(',')})` : 'id.eq.00000000-0000-0000-0000-000000000000'].join(','))
  const quizIds = (quizzes ?? []).map((q) => q.id)

  const { data: sessions } = await serviceClient
    .from('sessions')
    .select('id')
    .or(`tutor_id.in.(${demoUserIds.join(',')}),student_id.in.(${demoUserIds.join(',')})`)
  const sessionIds = (sessions ?? []).map((s) => s.id)

  if (sessionIds.length) await serviceClient.from('payments').delete().in('session_id', sessionIds)
  if (sessionIds.length) await serviceClient.from('reviews').delete().in('session_id', sessionIds)
  if (quizIds.length) await serviceClient.from('quiz_questions').delete().in('quiz_id', quizIds)
  await serviceClient.from('quiz_attempts').delete().in('user_id', demoUserIds)
  if (courseIds.length) await serviceClient.from('course_materials').delete().in('course_id', courseIds)
  await serviceClient.from('course_enrollments').delete().in('student_id', demoUserIds)
  if (quizIds.length) await serviceClient.from('quizzes').delete().in('id', quizIds)
  if (sessionIds.length) await serviceClient.from('sessions').delete().in('id', sessionIds)
  if (courseIds.length) await serviceClient.from('courses').delete().in('id', courseIds)

  for (const id of demoUserIds) {
    await serviceClient.auth.admin.deleteUser(id)
  }

  return { removed: demoUserIds.length }
}

const TUTOR_SEEDS = [
  {
    name: 'Kwabena Owusu',
    subjects: ['Mathematics', 'Physics'],
    rate: 60,
    bio: 'WASSCE Maths & Physics tutor, 6 years of exam-prep experience.',
    course: {
      title: 'WASSCE Core Maths: Algebra to Calculus',
      subject: 'Mathematics',
      description: 'A structured run through the algebra, trigonometry, and calculus topics that show up most on WASSCE.',
      material: {
        title: 'Quadratic Equations — reading',
        text: 'A quadratic equation has the form ax^2 + bx + c = 0, where a is not zero. It can be solved by factoring, completing the square, or the quadratic formula: x = (-b ± sqrt(b^2 - 4ac)) / 2a. The discriminant b^2 - 4ac tells you how many real solutions exist: positive means two, zero means one repeated solution, negative means none.',
      },
      quizTitle: 'Quadratic Equations Check',
      questions: [
        { q: 'What is the standard form of a quadratic equation?', options: ['ax + b = 0', 'ax^2 + bx + c = 0', 'ax^3 + b = 0', 'a/x + b = 0'], correct: 1 },
        { q: 'What does the discriminant b^2 - 4ac tell you?', options: ['The sum of the roots', 'The number of real solutions', 'The y-intercept', 'The axis of symmetry'], correct: 1 },
        { q: 'If the discriminant is negative, how many real solutions exist?', options: ['Two', 'One', 'Zero', 'Infinite'], correct: 2 },
        { q: 'Which method uses the formula x = (-b ± sqrt(b^2 - 4ac)) / 2a?', options: ['Factoring', 'Completing the square', 'The quadratic formula', 'Graphing'], correct: 2 },
      ],
    },
  },
  {
    name: 'Ama Serwaa',
    subjects: ['English', 'Literature'],
    rate: 45,
    bio: 'English Language and Literature tutor, exam-focused essay coaching.',
    course: {
      title: 'Essay Writing for WASSCE English',
      subject: 'English',
      description: 'Structure, argument, and style for the composition and comprehension sections.',
      material: {
        title: 'The Five-Paragraph Essay — reading',
        text: 'A strong essay opens with a hook and a clear thesis, develops three body paragraphs each anchored by one topic sentence and supporting evidence, and closes by restating the thesis in new words rather than just repeating it. Transitions between paragraphs should show how each idea builds on the last.',
      },
      quizTitle: 'Essay Structure Check',
      questions: [
        { q: 'What should a strong essay introduction include?', options: ['Only the topic', 'A hook and a clear thesis', 'The conclusion', 'A list of sources'], correct: 1 },
        { q: 'What anchors a body paragraph?', options: ['A topic sentence', 'A question', 'A quote only', 'Nothing in particular'], correct: 0 },
        { q: 'What should a conclusion do?', options: ['Introduce a new argument', 'Restate the thesis in new words', 'Repeat the introduction word for word', 'Ask the reader a question'], correct: 1 },
        { q: 'What do transitions between paragraphs show?', options: ['Grammar rules', 'How each idea builds on the last', 'The essay title', 'Word count'], correct: 1 },
      ],
    },
  },
  {
    name: 'Yaw Mensah',
    subjects: ['Chemistry', 'Biology'],
    rate: 55,
    bio: 'Science tutor specializing in practicals and past-question drilling.',
    course: {
      title: 'Cell Biology Foundations',
      subject: 'Biology',
      description: 'Cell structure, mitosis vs. meiosis, and the exam questions that trip students up most.',
      material: {
        title: 'Mitosis vs. Meiosis — reading',
        text: 'Mitosis produces two genetically identical daughter cells from one parent cell, used for growth and repair. Meiosis produces four genetically different daughter cells with half the chromosome number, used for producing gametes. Meiosis involves two rounds of division; mitosis involves one.',
      },
      quizTitle: 'Mitosis & Meiosis Check',
      questions: [
        { q: 'How many daughter cells does mitosis produce?', options: ['One', 'Two', 'Four', 'Eight'], correct: 1 },
        { q: 'How many daughter cells does meiosis produce?', options: ['One', 'Two', 'Four', 'Eight'], correct: 2 },
        { q: 'Are the cells produced by mitosis genetically identical or different?', options: ['Identical', 'Different', 'Half identical', 'Neither'], correct: 0 },
        { q: 'What is meiosis mainly used to produce?', options: ['Skin cells', 'Gametes', 'Blood cells', 'Muscle cells'], correct: 1 },
      ],
    },
  },
]

const STUDENT_SEEDS = ['Adjoa Boateng', 'Kojo Antwi', 'Efua Asante', 'Kwame Darko']

async function createDemoUser(fullName: string, role: 'tutor' | 'student', index: number) {
  const email = `${role}${index}.${fullName.split(' ')[0].toLowerCase()}@${DEMO_DOMAIN}`
  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  })
  if (error) throw error
  return data.user
}

async function seed() {
  await cleanup()

  const tutors = []
  for (let i = 0; i < TUTOR_SEEDS.length; i++) {
    const seed = TUTOR_SEEDS[i]
    const user = await createDemoUser(seed.name, 'tutor', i + 1)
    await serviceClient
      .from('profiles')
      .update({
        subjects: seed.subjects,
        hourly_rate: seed.rate,
        bio: seed.bio,
        verification_status: 'verified',
        avatar_emoji: ['🧮', '📖', '🧬'][i % 3],
      })
      .eq('id', user.id)
    tutors.push({ id: user.id, seed })
  }

  const students = []
  for (let i = 0; i < STUDENT_SEEDS.length; i++) {
    const user = await createDemoUser(STUDENT_SEEDS[i], 'student', i + 1)
    students.push(user.id)
  }

  const courses = []
  const quizzesByCourse: Record<string, { id: string; totalQuestions: number }> = {}
  for (const t of tutors) {
    const { data: course } = await serviceClient
      .from('courses')
      .insert({ tutor_id: t.id, title: t.seed.course.title, subject: t.seed.course.subject, description: t.seed.course.description })
      .select()
      .single()

    await serviceClient.from('course_materials').insert({
      course_id: course.id,
      title: t.seed.course.material.title,
      extracted_text: t.seed.course.material.text,
    })

    const { data: quiz } = await serviceClient
      .from('quizzes')
      .insert({ title: t.seed.course.quizTitle, subject: t.seed.course.subject, created_by: t.id, course_id: course.id })
      .select()
      .single()

    await serviceClient.from('quiz_questions').insert(
      t.seed.course.questions.map((q, i) => ({
        quiz_id: quiz.id,
        question: q.q,
        options: q.options,
        correct_index: q.correct,
        position: i,
      }))
    )

    courses.push({ id: course.id, tutorId: t.id })
    quizzesByCourse[course.id] = { id: quiz.id, totalQuestions: t.seed.course.questions.length }
  }

  // Enroll each student in 1-2 courses, spread across tutors.
  for (let i = 0; i < students.length; i++) {
    const enrolledCourses = [courses[i % courses.length], courses[(i + 1) % courses.length]]
    for (const c of enrolledCourses) {
      await serviceClient.from('course_enrollments').insert({ course_id: c.id, student_id: students[i] }).select()
    }
  }

  // Sessions + payments: a mix of completed (paid out) and confirmed
  // (collected, not yet released) so the tutor dashboard's earnings tiles
  // and the "needs a check-in" panel both have something to show.
  const sessionPlans = [
    { studentIdx: 0, tutorIdx: 0, status: 'completed', daysOffset: -10 },
    { studentIdx: 0, tutorIdx: 1, status: 'completed', daysOffset: -4 },
    { studentIdx: 1, tutorIdx: 0, status: 'confirmed', daysOffset: 3 },
    { studentIdx: 2, tutorIdx: 2, status: 'completed', daysOffset: -20 },
    { studentIdx: 3, tutorIdx: 2, status: 'confirmed', daysOffset: 5 },
  ]

  for (const plan of sessionPlans) {
    const tutor = tutors[plan.tutorIdx]
    const studentId = students[plan.studentIdx]
    const scheduledAt = plan.daysOffset < 0 ? daysAgo(-plan.daysOffset) : daysFromNow(plan.daysOffset)
    const { data: session } = await serviceClient
      .from('sessions')
      .insert({
        tutor_id: tutor.id,
        student_id: studentId,
        scheduled_at: scheduledAt,
        duration_minutes: 60,
        timezone: 'Africa/Accra',
        status: plan.status,
      })
      .select()
      .single()

    const amountMinor = Math.round(tutor.seed.rate * 100)
    await serviceClient.from('payments').insert({
      session_id: session.id,
      student_id: studentId,
      tutor_id: tutor.id,
      amount_minor: amountMinor,
      currency: 'GHS',
      paystack_reference: `demo_${crypto.randomUUID()}`,
      status: plan.status === 'completed' ? 'transferred' : 'paid',
    })

    if (plan.status === 'completed') {
      await serviceClient.from('reviews').insert({
        session_id: session.id,
        reviewer_id: studentId,
        reviewee_id: tutor.id,
        rating: 4 + (Math.random() > 0.5 ? 1 : 0),
        comment: 'Explained things clearly and patiently — helped a lot before my exam.',
      })
    }
  }

  // Quiz attempts: most students do reasonably well, one is deliberately
  // struggling so the tutor "needs a check-in" panel has something real to
  // flag in a demo.
  const attemptPlans = [
    { studentIdx: 0, courseIdx: 0, percent: 100, daysAgo: 9 },
    { studentIdx: 0, courseIdx: 1, percent: 75, daysAgo: 3 },
    { studentIdx: 1, courseIdx: 0, percent: 50, daysAgo: 2 },
    { studentIdx: 1, courseIdx: 1, percent: 25, daysAgo: 1 },
    { studentIdx: 2, courseIdx: 2, percent: 100, daysAgo: 19 },
    { studentIdx: 3, courseIdx: 2, percent: 75, daysAgo: 6 },
  ]

  for (const plan of attemptPlans) {
    const course = courses[plan.courseIdx % courses.length]
    const quiz = quizzesByCourse[course.id]
    const score = Math.round((plan.percent / 100) * quiz.totalQuestions)
    await serviceClient.from('quiz_attempts').insert({
      quiz_id: quiz.id,
      user_id: students[plan.studentIdx],
      score,
      total: quiz.totalQuestions,
      completed_at: daysAgo(plan.daysAgo),
    })
  }

  return { tutors: tutors.length, students: students.length, courses: courses.length, sessions: sessionPlans.length }
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight

  const admin = await requireAdmin(req)
  if (!admin) return json({ error: 'Admin only' })

  const { action } = await req.json().catch(() => ({ action: 'seed' }))

  try {
    const result = action === 'cleanup' ? await cleanup() : await seed()
    return json({ ok: true, action: action === 'cleanup' ? 'cleanup' : 'seed', result })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Seeding failed' })
  }
})
