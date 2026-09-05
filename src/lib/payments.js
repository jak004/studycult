export function paymentStatusLabel(status) {
  return (
    {
      pending: 'Payment pending confirmation',
      paid: 'Paid',
      transferred: 'Payout sent',
      failed: 'Payment failed',
      refunded: 'Refunded',
    }[status] || status
  )
}
