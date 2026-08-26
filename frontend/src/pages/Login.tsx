import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Shield, Eye, EyeOff, Zap, Lock, Brain, BarChart3 } from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import type { UserRole } from '../types'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useApp()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('Admin')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    login(email, password, role)
    navigate('/dashboard')
  }

  const handleDemo = () => {
    login('demo@riskguard.io', 'demo123', 'Admin')
    navigate('/dashboard')
  }

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
            AI-Powered Risk & Fraud Detection
          </h1>
          <p className="text-gray-400 text-lg mb-8">
            Protect your business with intelligent, real-time fraud analysis.
          </p>

          <div className="space-y-4">
            {[
              { icon: Zap, text: 'Real-time transaction monitoring' },
              { icon: Brain, text: 'Machine learning anomaly detection' },
              { icon: BarChart3, text: 'Advanced risk scoring & analytics' },
              { icon: Lock, text: 'Enterprise-grade security' },
            ].map((feature) => (
              <div key={feature.text} className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#4F6DF5]/10">
                  <feature.icon className="w-4 h-4 text-[#4F6DF5]" />
                </div>
                <span className="text-gray-300 text-sm">{feature.text}</span>
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

          <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
          <p className="text-gray-400 text-sm mb-8">Sign in to your account to continue</p>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                  placeholder="Enter your password"
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

            <button
              type="button"
              onClick={handleDemo}
              className="w-full py-2.5 rounded-xl border border-[#4F6DF5]/30 text-[#4F6DF5] font-medium text-sm hover:bg-[#4F6DF5]/10 transition-all duration-200"
            >
              Continue as Demo User
            </button>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#4F6DF5] text-white font-medium text-sm hover:shadow-[0_0_20px_rgba(79,109,245,0.3)] transition-all duration-200"
            >
              Sign In
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-[#4F6DF5] hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
