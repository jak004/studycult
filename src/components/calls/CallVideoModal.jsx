import { useEffect, useRef } from 'react'
import { useCall } from '../../context/CallContext'

// The actual video surface once a call is accepted, shown to both sides.
// Uses Jitsi's IFrame External API (a script tag, not a package — Jitsi's
// public server needs no build step) instead of a bare <iframe src=...>
// so we get a real videoConferenceLeft event: hanging up from inside
// Jitsi's own UI marks the call ended the same as clicking our Leave
// button, which is what lets the *other* participant's overlay close too
// (via the resulting `calls` row UPDATE, handled in CallContext).
export default function CallVideoModal() {
  const { activeCall, leaveActiveCall } = useCall()
  const containerRef = useRef(null)
  const apiRef = useRef(null)

  useEffect(() => {
    if (!activeCall) return
    let cancelled = false

    function mount() {
      if (cancelled || !containerRef.current || !window.JitsiMeetExternalAPI) return
      const roomName = activeCall.roomUrl.split('/').pop()
      const api = new window.JitsiMeetExternalAPI('meet.jit.si', {
        roomName,
        parentNode: containerRef.current,
        width: '100%',
        height: '100%',
      })
      api.addEventListener('videoConferenceLeft', leaveActiveCall)
      apiRef.current = api
    }

    if (window.JitsiMeetExternalAPI) {
      mount()
    } else {
      const script = document.createElement('script')
      script.src = 'https://meet.jit.si/external_api.js'
      script.async = true
      script.onload = mount
      document.body.appendChild(script)
    }

    return () => {
      cancelled = true
      apiRef.current?.dispose()
      apiRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCall?.id])

  if (!activeCall) return null

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-ink">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm font-bold text-paper">Call with {activeCall.otherName}</p>
        <button
          onClick={leaveActiveCall}
          className="rounded border border-paper/30 px-3 py-1.5 text-xs font-bold text-paper hover:border-paper"
        >
          Leave
        </button>
      </div>
      <div ref={containerRef} className="min-h-0 flex-1" />
    </div>
  )
}
