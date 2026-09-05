import * as pdfjsLib from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

// Capped so a huge slide deck doesn't blow past the LLM's context window (or
// run up an unnecessarily large bill) — plenty of material for a handful of
// quiz questions.
const DEFAULT_MAX_CHARS = 12000

export async function extractPdfText(file, { maxChars = DEFAULT_MAX_CHARS } = {}) {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise

  let text = ''
  for (let pageNum = 1; pageNum <= pdf.numPages && text.length < maxChars; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()
    text += content.items.map((item) => item.str).join(' ') + '\n\n'
  }

  return text.slice(0, maxChars)
}
