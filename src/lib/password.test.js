import { describe, expect, it } from 'vitest'
import { checkPassword } from './password'

describe('checkPassword', () => {
  it('rejects a short password', () => {
    expect(checkPassword('Ab1!').length).toBe(false)
  })

  it('requires at least 3 of the 4 character classes', () => {
    expect(checkPassword('alllowercase').variety).toBe(false)
    expect(checkPassword('Alllowercase1').variety).toBe(true)
  })

  it('rejects 3+ identical characters in a row', () => {
    expect(checkPassword('Passsword1!').noRepeats).toBe(false)
    expect(checkPassword('Password1!').noRepeats).toBe(true)
  })

  it('accepts a password meeting every rule', () => {
    const result = checkPassword('CorrectHorse1!')
    expect(result).toEqual({ length: true, variety: true, noRepeats: true })
  })

  it('treats an empty password as failing noRepeats too', () => {
    expect(checkPassword('').noRepeats).toBe(false)
  })
})
