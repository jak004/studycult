import { describe, expect, it } from 'vitest'
import { displayName, joinNameParts, splitFullName } from './names'

describe('joinNameParts', () => {
  it('joins first, middle, and last with single spaces', () => {
    expect(joinNameParts('Ama', 'Serwaa', 'Owusu')).toBe('Ama Serwaa Owusu')
  })

  it('skips a blank middle name rather than leaving a double space', () => {
    expect(joinNameParts('Ama', '', 'Owusu')).toBe('Ama Owusu')
    expect(joinNameParts('Ama', null, 'Owusu')).toBe('Ama Owusu')
  })

  it('trims stray whitespace on each part', () => {
    expect(joinNameParts('  Ama ', '  ', ' Owusu  ')).toBe('Ama Owusu')
  })
})

describe('splitFullName', () => {
  it('splits a three-word name into first/middle/last', () => {
    expect(splitFullName('Ama Serwaa Owusu')).toEqual({ firstName: 'Ama', middleName: 'Serwaa', lastName: 'Owusu' })
  })

  it('treats a two-word name as first + last with no middle', () => {
    expect(splitFullName('Ama Owusu')).toEqual({ firstName: 'Ama', middleName: '', lastName: 'Owusu' })
  })

  it('puts every extra word into the middle name, not just the first one', () => {
    expect(splitFullName('Ama Serwaa Boateng Owusu')).toEqual({
      firstName: 'Ama',
      middleName: 'Serwaa Boateng',
      lastName: 'Owusu',
    })
  })

  it('treats a single word as just a first name', () => {
    expect(splitFullName('Ama')).toEqual({ firstName: 'Ama', middleName: '', lastName: '' })
  })

  it('handles an empty or missing name without throwing', () => {
    expect(splitFullName('')).toEqual({ firstName: '', middleName: '', lastName: '' })
    expect(splitFullName()).toEqual({ firstName: '', middleName: '', lastName: '' })
  })
})

describe('displayName', () => {
  const student = { role: 'student', full_name: 'Kojo Antwi', username: 'kojo_studies' }
  const tutor = { role: 'tutor', full_name: 'Kwabena Owusu', username: null }

  it('falls back to "Someone" when there is no target at all', () => {
    expect(displayName(null, 'student')).toBe('Someone')
  })

  it("always shows a tutor's real name, regardless of viewer role", () => {
    expect(displayName(tutor, 'student')).toBe('Kwabena Owusu')
    expect(displayName(tutor, 'tutor')).toBe('Kwabena Owusu')
  })

  it('shows a student their username to a peer viewer', () => {
    expect(displayName(student, 'student')).toBe('kojo_studies')
  })

  it("always shows a tutor viewer the student's real name, even if a username is set", () => {
    expect(displayName(student, 'tutor')).toBe('Kojo Antwi')
  })

  it('falls back to full_name when the student has no username set', () => {
    expect(displayName({ role: 'student', full_name: 'Efua Asante', username: null }, 'student')).toBe('Efua Asante')
  })
})
