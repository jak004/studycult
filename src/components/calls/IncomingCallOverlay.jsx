import Card from '../ui/Card'
import Button from '../ui/Button'
import { useCall } from '../../context/CallContext'
import { initials } from '../../lib/format'

// Mounted once at the app root (main.jsx) — fixed/full-screen so it appears
// over whatever page the receiver is on, not just inside the chat the call
// belongs to.
export default function IncomingCallOverlay() {
  const { incomingCall, respondAccept, respondDecline } = useCall()
  if (!incomingCall) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <Card className="w-full max-w-sm p-6 text-center shadow-lg">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">Incoming video call</p>

        <div className="relative mx-auto mt-4 h-20 w-20">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
          <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-ink text-2xl font-bold text-paper">
            {incomingCall.callerAvatarUrl ? (
              <img src={incomingCall.callerAvatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>{initials(incomingCall.callerName)}</span>
            )}
          </div>
        </div>

        <p className="mt-4 text-lg font-bold text-ink">{incomingCall.callerName}</p>
        <p className="mt-1 text-sm text-muted">is calling you</p>

        <div className="mt-6 flex gap-3">
          <Button variant="danger-solid" size="lg" onClick={respondDecline} className="flex-1">
            Decline
          </Button>
          <Button variant="success" size="lg" onClick={respondAccept} className="flex-1">
            Accept
          </Button>
        </div>
      </Card>
    </div>
  )
}
