import { useState, useEffect } from 'react'

const STORAGE_KEY = 'ai-risk-manager-onboarded'

interface Step {
  title: string
  description: string
  target: string // CSS selector for the sidebar nav item
}

const steps: Step[] = [
  {
    title: 'Dashboard',
    description: 'This is your main overview of risk metrics, trends, and flagged transactions. Start here every day.',
    target: 'a[href="/"]',
  },
  {
    title: 'Risk Analysis',
    description: 'Deep dive into risk patterns, contributing factors, and model performance metrics.',
    target: 'a[href="/risk-analysis"]',
  },
  {
    title: 'Alerts',
    description: 'Review and take action on flagged transactions. Confirm fraud or mark as false positives.',
    target: 'a[href="/alerts"]',
  },
  {
    title: 'Transactions',
    description: 'Browse and search all transactions. Filter by risk level and inspect individual records.',
    target: 'a[href="/transactions"]',
  },
]

export default function Onboarding() {
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    try {
      const done = localStorage.getItem(STORAGE_KEY)
      if (!done) {
        // Small delay to let the sidebar render
        const timer = setTimeout(() => setShow(true), 800)
        return () => clearTimeout(timer)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!show) return
    const target = steps[step]?.target
    if (!target) return

    const el = document.querySelector(target) as HTMLElement | null
    if (el) {
      const rect = el.getBoundingClientRect()
      setTooltipPos({
        top: rect.top + rect.height / 2 - 10,
        left: rect.right + 16,
      })
    }
  }, [show, step])

  function complete() {
    try { localStorage.setItem(STORAGE_KEY, 'true') } catch {}
    setShow(false)
  }

  function skip() {
    complete()
  }

  function next() {
    if (step < steps.length - 1) {
      setStep(step + 1)
    } else {
      complete()
    }
  }

  if (!show) return null

  const current = steps[step]

  return (
    <>
      <div className="onboarding-overlay" onClick={skip} />
      <div
        className="onboarding-tooltip"
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
      >
        <div className="onboarding-progress">
          {steps.map((_, i) => (
            <span key={i} className={`onboarding-dot ${i === step ? 'active' : ''}`} />
          ))}
        </div>
        <h4>{current.title}</h4>
        <p>{current.description}</p>
        <div className="onboarding-actions">
          <button className="onboarding-skip" onClick={skip}>Skip tour</button>
          <button className="onboarding-next" onClick={next}>
            {step < steps.length - 1 ? 'Next' : 'Got it!'}
          </button>
        </div>
      </div>
    </>
  )
}
