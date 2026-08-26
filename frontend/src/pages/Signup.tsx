import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Shield, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import type { UserRole } from '../types'

export default function Signup() {
  const navigate = useNavigate()
  const { login } = useApp()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<UserRole>('Admin')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [agreed, setAgreed] = useState(false)

  const passwordStrength = () => {
    let score = 0
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++
    return score
  }

  const strength = passwordStrength()
  const strengthColors = ['bg-red-500', 'bg-amber-500', 'bg-yellow-400', 'bg-emerald-500']
  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong']

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreed) return
    login(email, password, role)
    navigate('/dashboard')
  }

  const benefits = [
    'AI-powered fraud detection engine',
    'Real-time transaction monitoring',
    'Customizable risk scoring rules',
    'Comprehensive audit trail logging',
    'Team collaboration & case management',
  ]

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0B1120] via-[#0F172A] to-[#1a1a3e] p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#4F6DF5]/10 via-transparent to-[#7C5CFC]/10" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-[#4F6DF5] to-[#7C5CFC]">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-[#4F6DF5] to-[#7C5CFC] bg-clip-text text-transparent">
              RiskGuard
            </span>
          </div>
        </div>

        <div className="relative z-10">
          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            Start protecting your business today
          </h1>
          <p className="text-gray-400 text-lg mb-8">
            Join thousands of companies using AI to detect and prevent fraud.
          </p>

          <div className="space-y-4">
            {benefits.map((text) => (
              <div key={text} className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                <span className="text-gray-300 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-gray-600 text-sm">
          &copy; 2026 RiskGuard. All rights reserved.
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 bg-[#0F172A]">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#4F6DF5] to-[#7C5CFC]">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-[#4F6DF5] to-[#7C5CFC] bg-clip-text text-transparent">
              RiskGuard
            </span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-1">Create your account</h2>
          <p className="text-gray-400 text-sm mb-8">Get started with RiskGuard in minutes</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm outline-none focus:border-[#4F6DF5]/50 focus:bg-white/10 transition-all duration-200"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm outline-none focus:border-[#4F6DF5]/50 focus:bg-white/10 transition-all duration-200"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="w-full px-4 py-2.5 pr-10 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm outline-none focus:border-[#4F6DF5]/50 focus:bg-white/10 transition-all duration-200"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors duration-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all duration-200 ${
                          i < strength ? strengthColors[strength - 1] : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs mt-1 ${strength > 0 ? 'text-gray-400' : 'text-gray-600'}`}>
                    {strength > 0 ? strengthLabels[strength - 1] : 'Enter a password'}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="w-full px-4 py-2.5 pr-10 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm outline-none focus:border-[#4F6DF5]/50 focus:bg-white/10 transition-all duration-200"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors duration-200"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && confirmPassword !== password && (
                <p className="text-xs mt-1 text-red-400">Passwords do not match</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-[#4F6DF5]/50 transition-all duration-200 appearance-none cursor-pointer"
              >
                <option value="Admin" className="bg-[#0F172A]">Admin</option>
                <option value="Analyst" className="bg-[#0F172A]">Analyst</option>
                <option value="Viewer" className="bg-[#0F172A]">Viewer</option>
              </select>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-[#4F6DF5] focus:ring-[#4F6DF5]/50"
              />
              <span className="text-xs text-gray-400 leading-relaxed">
                I agree to the{' '}
                <span className="text-[#4F6DF5] hover:underline">Terms of Service</span>{' '}
                and{' '}
                <span className="text-[#4F6DF5] hover:underline">Privacy Policy</span>
              </span>
            </label>

            <button
              type="submit"
              disabled={!agreed}
              className="w-full py-2.5 rounded-xl bg-[#4F6DF5] text-white font-medium text-sm hover:shadow-[0_0_20px_rgba(79,109,245,0.3)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Account
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-[#4F6DF5] hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
