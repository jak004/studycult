import { useEffect, useState } from 'react'

// Uses the browser's built-in Web Speech API (no key, no cost) to read
// content aloud — a small win for accessibility that doesn't require any
// backend work.
export default function SpeakButton({ text, className = '' }) {
  const [speaking, setSpeaking] = useState(false)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!supported || !text?.trim()) return null

  function toggle() {
    window.speechSynthesis.cancel()
    if (speaking) {
      setSpeaking(false)
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
    setSpeaking(true)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={speaking ? 'Stop reading aloud' : 'Read aloud'}
      title={speaking ? 'Stop reading aloud' : 'Read aloud'}
      className={className || 'text-muted hover:text-ink'}
    >
      {speaking ? '⏹' : '🔊'}
    </button>
  )
}
