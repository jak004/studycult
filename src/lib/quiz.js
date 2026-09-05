export function scoreQuiz(questions, answers) {
  return questions.reduce((correct, q) => (answers[q.id] === q.correct_index ? correct + 1 : correct), 0)
}
