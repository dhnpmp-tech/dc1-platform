import { Suspense } from 'react'
import RenterOnboardingFlow from '../components/RenterOnboardingFlow'

export default function OnboardingPage() {
  return (
    <Suspense>
      <RenterOnboardingFlow />
    </Suspense>
  )
}
