import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ProfileTab from './settings/ProfileTab'
import AvailabilityTab from './settings/AvailabilityTab'
import PayoutsTab from './settings/PayoutsTab'
import VerificationTab from './settings/VerificationTab'
import PaymentHistoryTab from './settings/PaymentHistoryTab'
import BlockedUsersTab from './settings/BlockedUsersTab'
import ReferralTab from './settings/ReferralTab'
import ReportsTab from './settings/ReportsTab'

export default function Profile() {
  const { profile, refreshProfile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') || 'profile')

  if (!profile) return null
  const isTutor = profile.role === 'tutor'

  function selectTab(id) {
    setTab(id)
    setSearchParams(id === 'profile' ? {} : { tab: id })
  }

  const tabs = [
    { id: 'profile', label: 'Profile' },
    ...(isTutor ? [{ id: 'availability', label: 'Availability' }] : []),
    ...(isTutor ? [{ id: 'payouts', label: 'Payouts' }] : []),
    ...(isTutor ? [{ id: 'verification', label: 'Verification' }] : []),
    { id: 'payments', label: 'Payment history' },
    { id: 'blocked', label: 'Blocked users' },
    { id: 'referral', label: 'Refer a friend' },
    ...(!isTutor ? [{ id: 'reports', label: 'Progress reports' }] : []),
  ]

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="grid gap-8 md:grid-cols-[200px_1fr]">
        <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTab(t.id)}
              className={`shrink-0 rounded-xl px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-teal-soft'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div>
          {tab === 'profile' && <ProfileTab profile={profile} refreshProfile={refreshProfile} />}
          {tab === 'availability' && isTutor && <AvailabilityTab tutorId={profile.id} />}
          {tab === 'payouts' && isTutor && <PayoutsTab profile={profile} refreshProfile={refreshProfile} />}
          {tab === 'verification' && isTutor && (
            <VerificationTab profile={profile} refreshProfile={refreshProfile} />
          )}
          {tab === 'payments' && <PaymentHistoryTab profile={profile} />}
          {tab === 'blocked' && <BlockedUsersTab myId={profile.id} />}
          {tab === 'referral' && <ReferralTab profile={profile} />}
          {tab === 'reports' && !isTutor && <ReportsTab profile={profile} />}
        </div>
      </div>
    </div>
  )
}
