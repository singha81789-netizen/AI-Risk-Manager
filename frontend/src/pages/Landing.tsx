import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Shield, Zap, Brain, Bell, FileBarChart, Briefcase, ScrollText,
  Upload, Cpu, ShieldCheck, Activity, ShieldAlert, Target, ArrowRight, ChevronRight
} from 'lucide-react'

function useCountUp(target: number, duration = 2000, trigger = false) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!trigger) return
    let start = 0
    const startTime = performance.now()
    function animate(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [trigger, target, duration])
  return value
}

function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); obs.disconnect() }
    }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, inView }
}

function StatCard({ icon: Icon, value, suffix, label, trigger }: { icon: React.ElementType; value: number; suffix: string; label: string; trigger: boolean }) {
  const count = useCountUp(value, 2200, trigger)
  return (
    <div className="glass-card p-6 flex flex-col items-center text-center gap-2">
      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mb-1">
        <Icon className="w-5 h-5 text-accent" />
      </div>
      <span className="text-2xl font-bold text-white">{count.toLocaleString()}{suffix}</span>
      <span className="text-sm text-navy-300">{label}</span>
    </div>
  )
}

const FEATURES = [
  { icon: Zap, title: 'Real-time Detection', desc: 'Monitor every transaction in real-time with sub-millisecond response times', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { icon: Brain, title: 'AI Models', desc: 'Multiple ensemble ML models working together for superior detection accuracy', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { icon: Bell, title: 'Smart Alerts', desc: 'Intelligent severity classification reduces alert fatigue by 60%', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { icon: FileBarChart, title: 'Detailed Reports', desc: 'Comprehensive analytics with PDF/Excel export and scheduled delivery', color: 'text-green-400', bg: 'bg-green-500/10' },
  { icon: Briefcase, title: 'Case Management', desc: 'Track, investigate, and resolve fraud cases with team collaboration', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  { icon: ScrollText, title: 'Audit Trail', desc: 'Complete audit logging for SOC2, PCI-DSS, and regulatory compliance', color: 'text-rose-400', bg: 'bg-rose-500/10' },
]

const STEPS = [
  { icon: Upload, title: 'Upload Transactions', desc: 'Import CSV/Excel files or connect via API' },
  { icon: Cpu, title: 'AI Analysis', desc: 'Our ensemble models score every transaction in real-time' },
  { icon: ShieldCheck, title: 'Act & Resolve', desc: 'Review flagged items, investigate cases, and prevent fraud' },
]

export default function Landing() {
  const statsHook = useInView(0.15)
  const featuresHook = useInView(0.1)
  const stepsHook = useInView(0.1)

  return (
    <div className="min-h-screen bg-navy-950 text-white overflow-hidden">
      {/* ─── Navbar ─── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-navy-950/60 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-purple flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-accent to-purple bg-clip-text text-transparent">RiskGuard</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-navy-200">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm text-navy-200 hover:text-white transition-colors hidden sm:block">Login</Link>
            <Link to="/register" className="btn-primary text-sm px-5 py-2">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden" style={{ background: 'linear-gradient(180deg, #0B1120 0%, #0F172A 40%, #161F32 100%)' }}>
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 59px, rgba(79,109,245,0.3) 59px, rgba(79,109,245,0.3) 60px), repeating-linear-gradient(90deg, transparent, transparent 59px, rgba(79,109,245,0.3) 59px, rgba(79,109,245,0.3) 60px)', backgroundSize: '60px 60px' }} />
        {/* Gradient orbs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-purple/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-accent/10 rounded-full blur-[80px]" />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-sm font-medium mb-8">
            <Zap className="w-4 h-4" />
            AI-Powered Risk Detection
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            Protect Your Business with<br />
            <span className="bg-gradient-to-r from-accent via-purple to-accent bg-clip-text text-transparent">Intelligent Fraud Detection</span>
          </h1>

          <p className="text-lg text-navy-300 max-w-2xl mx-auto mb-10">
            Real-time AI monitoring, anomaly detection, and intelligent alerting for modern financial operations.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register" className="btn-primary text-base px-8 py-3 flex items-center gap-2">
              Get Started Free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/dashboard" className="btn-secondary text-base px-8 py-3 flex items-center gap-2">
              View Live Demo <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Stats strip */}
        <div ref={statsHook.ref} className="relative z-10 max-w-5xl mx-auto mt-20 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Activity} value={2400000} suffix="+" label="Transactions Monitored" trigger={statsHook.inView} />
          <StatCard icon={ShieldAlert} value={15847} suffix="" label="Frauds Detected" trigger={statsHook.inView} />
          <StatCard icon={Target} value={997} suffix="%" label="Accuracy Rate" trigger={statsHook.inView} />
          <StatCard icon={Brain} value={5} suffix="" label="Active Models" trigger={statsHook.inView} />
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="py-24 px-6 bg-navy-950">
        <div ref={featuresHook.ref} className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Why <span className="text-accent">RiskGuard</span>?</h2>
            <p className="text-navy-300 text-lg max-w-2xl mx-auto">Enterprise-grade fraud detection powered by cutting-edge AI</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className={`glass-card p-6 group cursor-default transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(79,109,245,0.12)] stagger-${i + 1} ${featuresHook.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className={`w-12 h-12 rounded-2xl ${f.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <f.icon className={`w-6 h-6 ${f.color}`} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-navy-300 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="py-24 px-6 bg-navy-900/50">
        <div ref={stepsHook.ref} className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-navy-300 text-lg">Three simple steps to fraud protection</p>
          </div>
          <div className="relative grid md:grid-cols-3 gap-8">
            {/* Connecting lines (desktop) */}
            <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-px border-t-2 border-dashed border-navy-600" />
            {STEPS.map((s, i) => (
              <div
                key={s.title}
                className={`relative z-10 flex flex-col items-center text-center transition-all duration-500 ${stepsHook.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: `${i * 200}ms` }}
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent to-purple flex items-center justify-center text-white font-bold text-lg mb-5 shadow-lg shadow-accent/20">
                  {i + 1}
                </div>
                <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                  <s.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{s.title}</h3>
                <p className="text-navy-300 text-sm max-w-xs">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Trusted By ─── */}
      <section className="py-20 px-6 bg-navy-950">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-navy-400 text-sm uppercase tracking-widest mb-10">Trusted by leading organizations</p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {['Stripe', 'Square', 'PayPal', 'Shopify', 'Wise', 'Revolut'].map(name => (
              <span key={name} className="text-xl font-bold text-navy-600 hover:text-navy-400 transition-colors select-none cursor-default">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section id="pricing" className="py-24 px-6 bg-navy-950">
        <div className="max-w-3xl mx-auto">
          <div className="relative glass-card p-12 text-center rounded-3xl overflow-hidden">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-accent/20 via-purple/20 to-accent/20" style={{ padding: '1px', WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude' }} />
            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to protect your business?</h2>
              <p className="text-navy-300 text-lg mb-8">Start detecting fraud in minutes. No credit card required.</p>
              <Link to="/register" className="btn-primary text-base px-10 py-3.5 inline-flex items-center gap-2">
                Start Free Trial <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="bg-navy-950 border-t border-white/5 pt-16 pb-8 px-6">
        <div className="max-w-6xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          <div>
            <Link to="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-purple flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold bg-gradient-to-r from-accent to-purple bg-clip-text text-transparent">RiskGuard</span>
            </Link>
            <p className="text-navy-400 text-sm leading-relaxed">AI-powered fraud detection and risk management for modern financial operations.</p>
          </div>
          <div>
            <h4 className="font-semibold text-white text-sm mb-4">Product</h4>
            <ul className="space-y-2.5 text-sm text-navy-400">
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
              <li><Link to="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
              <li><a href="#" className="hover:text-white transition-colors">API Docs</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white text-sm mb-4">Company</h4>
            <ul className="space-y-2.5 text-sm text-navy-400">
              <li><a href="#" className="hover:text-white transition-colors">About</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white text-sm mb-4">Legal</h4>
            <ul className="space-y-2.5 text-sm text-navy-400">
              <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Cookie Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">GDPR</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto border-t border-white/5 pt-8 text-center text-sm text-navy-500">
          &copy; {new Date().getFullYear()} RiskGuard. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
