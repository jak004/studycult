import { describe, expect, it } from 'vitest'
import { paymentStatusLabel } from './payments'

describe('paymentStatusLabel', () => {
  it('maps every known Paystack-driven status to a human label', () => {
    expect(paymentStatusLabel('pending')).toBe('Payment pending confirmation')
    expect(paymentStatusLabel('paid')).toBe('Paid')
    expect(paymentStatusLabel('transferred')).toBe('Payout sent')
    expect(paymentStatusLabel('failed')).toBe('Payment failed')
    expect(paymentStatusLabel('refunded')).toBe('Refunded')
  })

  it('falls back to the raw status for anything unrecognized, rather than showing nothing', () => {
    expect(paymentStatusLabel('some_future_status')).toBe('some_future_status')
  })
})
