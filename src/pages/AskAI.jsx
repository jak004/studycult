import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import SpeakButton from '../components/SpeakButton'
import { trackEvent } from '../lib/analytics'

const GREETING = "Hey! I'm your AI study tutor — ask me about anything you're working on. This is separate from messaging a human tutor, so use whichever fits: quick concept help here, or a real tutor for scheduled sessions."

const STARTER_PROMPTS = [
  'Explain photosynthesis to me',
  'Quiz me on the causes of World War 1',
  'Help me with this: solve for x in 2x + 5 = 17',
]

export default function AskAI() {
  const [messages, setMessages] = useState([{ role: 'assistant', content: GREETING }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function handleSubmit(e) {
    e.preventDefault()
    const content = input.trim()
    if (!content || sending) return

    setError('')
    const history = [...messages, { role: 'user', content }]
    setMessages(history)
    setInput('')
    setSending(true)

    const { data, error: invokeError } = await supabase.functions.invoke('ask-ai-tutor', {
      body: { messages: history.filter((m) => m.role !== 'system') },
    })

    setSending(false)

    if (invokeError || data?.error) {
      setError(data?.error || invokeError.message)
      return
    }

    trackEvent('AI Tutor Message Sent')
    setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-6rem)] max-w-3xl flex-col px-6 py-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Ask AI 🤖</h1>
        <p className="mt-1 text-sm text-muted">A 24/7 AI study tutor for quick explanations, in between sessions with real tutors.</p>
      </div>

      <div className="card mt-6 flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex flex-col gap-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`flex max-w-[80%] items-end gap-2 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                      m.role === 'user' ? 'bg-ink text-paper' : 'bg-teal-soft text-ink'
                    }`}
                  >
                    {m.content}
                  </div>
                  {m.role === 'assistant' && <SpeakButton text={m.content} className="mb-1 shrink-0 text-muted hover:text-ink" />}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-teal-soft px-4 py-2.5 text-sm text-ink-soft">Thinking…</div>
              </div>
            )}
            {messages.length === 1 && !sending && (
              <div className="flex flex-wrap gap-2">
                {STARTER_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setInput(p)}
                    className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-teal hover:text-teal"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div ref={bottomRef} />
        </div>

        {error && <p className="border-t border-line px-5 py-2 text-sm text-danger">{error}</p>}

        <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-line p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a study question…"
            className="input flex-1"
            disabled={sending}
          />
          <button type="submit" disabled={sending || !input.trim()} className="btn btn-primary px-5 py-2.5 text-sm">
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
