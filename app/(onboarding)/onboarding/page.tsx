'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getModeConfig } from '@/lib/mode'
import StepWelcome from './steps/StepWelcome'
import StepContext from './steps/StepContext'
import StepModels from './steps/StepModels'
import StepTour from './steps/StepTour'
import StepReady from './steps/StepReady'

const TOTAL_STEPS = 5

export default function OnboardingPage() {
 const router = useRouter()
 const [step, setStep] = useState(0)
 const [userName, setUserName] = useState('')

 useEffect(() => {
 fetch('/api/settings')
 .then(r => r.json())
 .then((d: { settings?: Record<string, string> }) => {
 if (d.settings?.ceo_name) setUserName(d.settings.ceo_name)
 })
 .catch(() => {})
 }, [])

 const completeTo = async (path: string) => {
 await fetch('/api/settings', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ key: 'onboarding_complete', value: 'true' }),
 }).catch(() => {})
 router.push(path)
 }

 const complete = () => completeTo('/')
 const next = () => {
 if (step < TOTAL_STEPS - 1) setStep(s => s + 1)
 else complete()
 }
 const back = () => setStep(s => Math.max(0, s - 1))

 const modeConfig = getModeConfig('journalism')

 return (
 <div className="relative min-h-screen flex flex-col items-center justify-start px-4 py-12">
 <button
 onClick={complete}
 className="absolute top-6 right-6 text-xs text-[var(--text-muted)] hover:text-[var(--text-subtle)] transition-colors"
 >
 Skip setup
 </button>

 <div className="flex items-center gap-1.5 mb-12">
 {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
 <div
 key={i}
 className={`h-1 rounded-full transition-all duration-300 ${
 i === step
 ? 'w-6 bg-[var(--ink)]'
 : i < step
 ? 'w-4 bg-[var(--border-mid)]'
 : 'w-4 bg-[var(--surface-3)]'
 }`}
 />
 ))}
 </div>

 <div className="w-full max-w-xl">
 {step === 0 && <StepWelcome userName={userName} onNext={next} />}
 {step === 1 && <StepContext modeConfig={modeConfig} onNext={next} onBack={back} />}
 {step === 2 && <StepModels onNext={next} onBack={back} onSkip={next} />}
 {step === 3 && <StepTour modeConfig={modeConfig} onNext={next} onBack={back} />}
 {step === 4 && <StepReady modeConfig={modeConfig} onComplete={complete} onUpload={() => completeTo('/upload')} />}
 </div>
 </div>
 )
}
