import Card from '../ui/Card'
import Button from '../ui/Button'
import { useCall } from '../../context/CallContext'
import { initials } from '../../lib/format'

const STATUS_TEXT = {
  ringing: 'Calling…',
  declined: 'Call declined',
  missed: 'No answer',
}

// Caller-side counterpart to IncomingCallOverlay — shown from the moment
// placeCall() fires until the receiver responds or the 30s ring times out.
export default function OutgoingCallOverlay() {
  const { outgoingCall, cancelOutgoingCall } = useCall()
  if (!outgoingCall) return null

  const ringing = outgoingCall.status === 'ringing'

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <Card className="w-full max-w-sm p-6 text-center shadow-lg">
        <div className="relative mx-auto mt-2 h-20 w-20">
          {ringing && <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />}
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-ink text-2xl font-bold text-paper">
            {initials(outgoingCall.receiverName)}
          </div>
        </div>

        <p className="mt-4 text-lg font-bold text-ink">{outgoingCall.receiverName}</p>
        <p className="mt-1 text-sm text-muted">{STATUS_TEXT[outgoingCall.status]}</p>

        {ringing && (
          <Button variant="danger-solid" size="lg" onClick={cancelOutgoingCall} className="mt-6 w-full">
            Cancel
          </Button>
        )}
      </Card>
    </div>
  )
}
