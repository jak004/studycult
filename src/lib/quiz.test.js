import { describe, expect, it } from 'vitest'
import { scoreQuiz } from './quiz'

const questions = [
  { id: 'q1', correct_index: 0 },
  { id: 'q2', correct_index: 2 },
  { id: 'q3', correct_index: 1 },
]

describe('scoreQuiz', () => {
  it('counts only correctly-answered questions', () => {
    const answers = { q1: 0, q2: 2, q3: 0 }
    expect(scoreQuiz(questions, answers)).toBe(2)
  })

  it('scores zero when nothing matches', () => {
    expect(scoreQuiz(questions, {})).toBe(0)
  })

  it('scores full marks when everything matches', () => {
    const answers = { q1: 0, q2: 2, q3: 1 }
    expect(scoreQuiz(questions, answers)).toBe(3)
  })

  it('ignores answers for questions that do not exist', () => {
    const answers = { q1: 0, doesNotExist: 5 }
    expect(scoreQuiz(questions, answers)).toBe(1)
  })
})
