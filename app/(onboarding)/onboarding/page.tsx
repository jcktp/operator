'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getModeConfig } from '@/lib/mode'
import StepWelcome from './steps/StepWelcome'
import StepMode from './steps/StepMode'
import StepContext from './steps/StepContext'
import StepTour from './steps/StepTour'
import StepReady from './steps/StepReady'

const TOTAL_STEPS = 5

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [modeId, setModeId] = useState('executive')
  const [userName, setUserName] = useState('')

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((d: { settings?: Record<string, string> }) => {
        if (d.settings?.app_mode) setModeId(d.settings.app_mode)
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

  const modeConfig = getModeConfig(modeId)

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-start px-4 py-12">
      <button
        onClick={complete}
        className="absolute top-6 right-6 text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
      >
        Skip setup
      </button>

      <div className="flex items-center gap-1.5 mb-12">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${
              i === step
                ? 'w-6 bg-gray-800 dark:bg-zinc-100'
                : i < step
                ? 'w-4 bg-gray-400 dark:bg-zinc-500'
                : 'w-4 bg-gray-200 dark:bg-zinc-700'
            }`}
          />
        ))}
      </div>

      <div className="w-full max-w-xl">
        {step === 0 && <StepWelcome userName={userName} onNext={next} />}
        {step === 1 && <StepMode modeConfig={modeConfig} onNext={next} onBack={back} />}
        {step === 2 && <StepContext modeConfig={modeConfig} onNext={next} onBack={back} />}
        {step === 3 && <StepTour modeConfig={modeConfig} onNext={next} onBack={back} />}
        {step === 4 && <StepReady modeConfig={modeConfig} onComplete={complete} onUpload={() => completeTo('/upload')} />}
      </div>
    </div>
  )
}
