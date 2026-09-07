import { useEffect, useRef } from 'react'
import DailyIframe from '@daily-co/daily-js'
import { useCall } from '../../context/CallContext'

// The actual video surface once a call is accepted, shown to both sides.
// Daily's own in-call toolbar already has mute/camera/leave controls, so
// this is just a thin header (who you're talking to, a backup Leave button)
// around the embed. The 'left-meeting' event is what lets the *other*
// participant's overlay close too — hanging up either from our header
// button or Daily's own leave button ends up updating the `calls` row,
// which the other side is watching via CallContext.
export default function CallVideoModal() {
  const { activeCall, leaveActiveCall } = useCall()
  const containerRef = useRef(null)
  const frameRef = useRef(null)

  useEffect(() => {
    if (!activeCall || !containerRef.current) return

    const callFrame = DailyIframe.createFrame(containerRef.current, {
      url: activeCall.roomUrl,
      showLeaveButton: true,
      iframeStyle: { width: '100%', height: '100%', border: '0' },
    })
    // Logged, not acted on — a camera/mic error shouldn't by itself end the
    // call (Daily's prejoin screen already gives the user a chance to grant
    // access or continue without a camera), but if a call ever drops again
    // this is the first thing to check in the console.
    const logError = (e) => console.error('Daily call error', e)
    callFrame.on('camera-error', logError)
    callFrame.on('error', logError)
    callFrame.on('left-meeting', leaveActiveCall)
    callFrame.join()
    frameRef.current = callFrame

    return () => {
      callFrame.off('camera-error', logError)
      callFrame.off('error', logError)
      callFrame.off('left-meeting', leaveActiveCall)
      callFrame.destroy()
      frameRef.current = null
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
