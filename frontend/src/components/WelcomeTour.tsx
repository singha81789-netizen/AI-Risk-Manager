import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ChevronRight, ChevronLeft, Shield, LayoutDashboard, CreditCard, Bell, Brain } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

interface TourStep {
  title: string
  description: string
  icon: React.ElementType
  path: string
  highlight?: string
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to RiskGuard',
    description: 'Your AI-powered fraud detection command center. This tour will walk you through the key features that help you detect and prevent fraud in real time.',
    icon: Shield,
    path: '/dashboard',
    highlight: 'tour-logo',
  },
  {
    title: 'Transaction Monitoring',
    description: 'View and analyze every transaction scored by our AI models. Click any row to see the full AI explainability breakdown — not just a score, but the reasoning behind it.',
    icon: CreditCard,
    path: '/transactions',
    highlight: 'tour-transactions',
  },
  {
    title: 'Intelligent Alerts',
    description: 'When the AI detects suspicious activity, alerts appear here with severity ratings, assignment workflows, and investigation timelines. Never miss a critical event.',
    icon: Bell,
    path: '/alerts',
    highlight: 'tour-alerts',
  },
  {
    title: 'AI Model Management',
    description: 'Monitor model performance, retrain with new data, and compare versions. Full transparency into how your detection models are performing.',
    icon: Brain,
    path: '/ai-models',
    highlight: 'tour-models',
  },
]

interface WelcomeTourProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
}

export default function WelcomeTour({ isOpen, onClose, onComplete }: WelcomeTourProps) {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const overlayRef = useRef<HTMLDivElement>(null)

  const current = TOUR_STEPS[step]
  const isLast = step === TOUR_STEPS.length - 1

  useEffect(() => {
    if (isOpen && current.path) {
      navigate(current.path, { replace: true })
    }
  }, [isOpen, step, current.path, navigate])

  const handleNext = useCallback(() => {
    if (isLast) {
      onComplete()
      onClose()
    } else {
      setStep(s => s + 1)
    }
  }, [isLast, onComplete, onClose])

  const handlePrev = useCallback(() => {
    if (step > 0) setStep(s => s - 1)
  }, [step])

  const handleSkip = useCallback(() => {
    onComplete()
    onClose()
  }, [onComplete, onClose])

  useEffect(() => {
    if (!isOpen) setStep(0)
  }, [isOpen])

  if (!isOpen) return null

  const Icon = current.icon

  return (
    <div className="fixed inset-0 z-[90]" ref={overlayRef}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleSkip} />

      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md mx-4 rounded-2xl shadow-2xl border overflow-hidden transition-all duration-300 ${
        isDark
          ? 'bg-[#161F32] border-[rgba(42,53,80,0.6)]'
          : 'bg-white border-gray-200'
      }`}>
        <div className={`h-1.5 w-full ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
          <div
            className="h-full bg-gradient-to-r from-[#4F6DF5] to-[#7C3AED] transition-all duration-500 ease-out rounded-full"
            style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#4F6DF5] to-[#7C3AED] flex items-center justify-center shadow-lg shadow-[#4F6DF5]/20">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  Step {step + 1} of {TOUR_STEPS.length}
                </p>
              </div>
            </div>
            <button
              onClick={handleSkip}
              className={`p-1.5 rounded-lg transition-colors duration-150 ${
                isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <h3 className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {current.title}
          </h3>
          <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {current.description}
          </p>
        </div>

        <div className={`px-8 py-4 border-t flex items-center justify-between ${
          isDark ? 'border-white/5' : 'border-gray-100'
        }`}>
          <button
            onClick={handleSkip}
            className={`text-sm font-medium transition-colors duration-150 ${
              isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Skip tour
          </button>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={handlePrev}
                className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isDark
                    ? 'text-gray-300 hover:bg-white/5'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-5 py-2 rounded-xl bg-gradient-to-r from-[#4F6DF5] to-[#7C3AED] text-white text-sm font-medium hover:shadow-lg hover:shadow-[#4F6DF5]/20 transition-all duration-200"
            >
              {isLast ? 'Get Started' : 'Next'}
              {!isLast && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
