export function checkPassword(pw) {
  const classCount = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length
  return {
    length: pw.length >= 8,
    variety: classCount >= 3,
    noRepeats: pw.length > 0 && !/(.)\1\1/.test(pw),
  }
}
