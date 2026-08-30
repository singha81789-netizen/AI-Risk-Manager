import { useState, useMemo, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  CreditCard, AlertTriangle, Activity, Bell, RefreshCw, TrendingUp, TrendingDown,
  ChevronRight, ExternalLink, FileText, BarChart3, Copy, CheckCircle2
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { useApp } from '../contexts/AppContext'

function useCountUp(target: number, duration = 1400, trigger = true) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!trigger || target === 0) { setValue(target); return }
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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatCurrency(n: number) {
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const CHART_TOOLTIP = { bg: '#1E293B', border: '#2A3550', text: '#F8FAFC' }
const PIE_COLORS = ['#10B981', '#F59E0B', '#EF4444']

type Range = 'Today' | '7D' | '30D'

export default function Dashboard() {
  const { transactions, alerts, models, riskDistribution } = useApp()
  const [range, setRange] = useState<Range>('30D')
  const [refreshKey, setRefreshKey] = useState(0)

  // Stats
  const totalCount = transactions.length
  const totalAmount = useMemo(() => transactions.reduce((s, t) => s + t.amount, 0), [transactions])
  const flaggedCount = useMemo(() => transactions.filter(t => t.flagged).length, [transactions])
  const highRiskPct = useMemo(() => totalCount ? Math.round((transactions.filter(t => t.riskLevel === 'HIGH').length / totalCount) * 100) : 0, [transactions, totalCount])
  const activeAlerts = useMemo(() => alerts.filter(a => a.status === 'New' || a.status === 'Under Review').length, [alerts])

  const tc = useCountUp(totalCount, 1600, refreshKey === 0)
  const fc = useCountUp(flaggedCount, 1600, refreshKey === 0)
  const hr = useCountUp(highRiskPct, 1600, refreshKey === 0)
  const ac = useCountUp(activeAlerts, 1600, refreshKey === 0)

  const handleRefresh = useCallback(() => setRefreshKey(k => k + 1), [])

  // Risk trend data (30 days seeded)
  const trendData = useMemo(() => {
    const days = range === 'Today' ? 1 : range === '7D' ? 7 : 30
    const base = { approved: 120, flagged: 18, declined: 8 }
    return Array.from({ length: days }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (days - 1 - i))
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const seed = i * 7 + 3
      return {
        date: dateStr,
        approved: Math.round(base.approved + Math.sin(seed) * 30 + (i % 5) * 5),
        flagged: Math.round(base.flagged + Math.cos(seed * 0.7) * 6 + (i % 3) * 2),
        declined: Math.round(base.declined + Math.sin(seed * 1.3) * 4 + (i % 4)),
      }
    })
  }, [range])

  // Top risky accounts
  const topRisky = useMemo(() =>
    [...transactions].sort((a, b) => b.riskScore - a.riskScore).slice(0, 8),
    [transactions]
  )

  // Pie data
  const pieData = useMemo(() => [
    { name: 'Low', value: riskDistribution.LOW },
    { name: 'Medium', value: riskDistribution.MEDIUM },
    { name: 'High', value: riskDistribution.HIGH },
  ], [riskDistribution])

  // Recent alerts
  const recentAlerts = useMemo(() => alerts.slice(0, 5), [alerts])

  // Active models
  const activeModels = useMemo(() => models.filter(m => m.status === 'active' || m.status === 'training'), [models])

  const statCards = [
    { label: 'Total Transactions', value: totalCount, display: tc, icon: CreditCard, trend: '+2.3%', trendUp: true, gradient: 'from-blue-500/20 to-blue-600/5', iconBg: 'bg-blue-500/15', iconColor: 'text-blue-400' },
    { label: 'Flagged Transactions', value: flaggedCount, display: fc, icon: AlertTriangle, trend: '-1.2%', trendUp: false, gradient: 'from-red-500/20 to-red-600/5', iconBg: 'bg-red-500/15', iconColor: 'text-red-400' },
    { label: 'High Risk %', value: highRiskPct, display: hr, icon: Activity, trend: '+0.5%', trendUp: true, gradient: 'from-amber-500/20 to-amber-600/5', iconBg: 'bg-amber-500/15', iconColor: 'text-amber-400', suffix: '%' },
    { label: 'Active Alerts', value: activeAlerts, display: ac, icon: Bell, trend: '-3.1%', trendUp: false, gradient: 'from-purple-500/20 to-purple-600/5', iconBg: 'bg-purple-500/15', iconColor: 'text-purple-400' },
  ]

  const severityColor = (s: string) => {
    if (s === 'Critical') return 'bg-red-500'
    if (s === 'High') return 'bg-orange-500'
    if (s === 'Medium') return 'bg-amber-500'
    return 'bg-blue-400'
  }

  const riskScoreColor = (score: number) => {
    if (score >= 85) return 'bg-red-500'
    if (score >= 70) return 'bg-amber-500'
    return 'bg-green-500'
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-navy-300 text-sm mt-1">Real-time overview of your risk landscape</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl bg-navy-800/60 border border-white/5 p-0.5">
            {(['Today', '7D', '30D'] as Range[]).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${range === r ? 'bg-accent text-white shadow-sm' : 'text-navy-300 hover:text-white'}`}
              >
                {r}
              </button>
            ))}
          </div>
          <button onClick={handleRefresh} className="p-2 rounded-xl bg-navy-800/60 border border-white/5 text-navy-300 hover:text-white hover:bg-navy-700/60 transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─── Stat Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(sc => (
          <div key={sc.label} className="glass-card p-5 group hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${sc.iconBg} flex items-center justify-center`}>
                <sc.icon className={`w-5 h-5 ${sc.iconColor}`} />
              </div>
              <span className={`text-xs font-medium flex items-center gap-1 ${sc.trendUp ? 'text-green-400' : 'text-red-400'}`}>
                {sc.trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {sc.trend}
              </span>
            </div>
            <div className="text-2xl font-bold text-white mb-0.5">{sc.display.toLocaleString()}{sc.suffix || ''}</div>
            <div className="text-xs text-navy-400">{sc.label}</div>
          </div>
        ))}
      </div>

      {/* ─── Risk Prioritization & Executive Summary ─── */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Risk Prioritization Overview */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-white">Risk Prioritization Overview</h3>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Credential Compromise', count: 12, pct: 92, color: 'bg-red-500' },
              { label: 'Identity Theft', count: 9, pct: 78, color: 'bg-orange-500' },
              { label: 'Synthetic Identity', count: 7, pct: 65, color: 'bg-amber-500' },
              { label: 'Account Takeover', count: 4, pct: 45, color: 'bg-yellow-500' },
              { label: 'Friendly Fraud', count: 2, pct: 28, color: 'bg-green-500' },
            ].map((item, i) => (
              <div key={item.label} className="flex items-center gap-3">
                <span className="text-xs text-navy-400 w-4 text-right font-medium">{i + 1}.</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-white font-medium">{item.label}</span>
                    <span className="text-xs text-navy-400">{item.count} occurrences</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-navy-700 overflow-hidden">
                    <div className={`h-full rounded-full ${item.color} transition-all duration-700`} style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
                <span className="text-xs font-semibold text-navy-200 w-10 text-right">{item.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Executive Summary */}
        <div className="glass-card p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-semibold text-white">Structured CFO Executive Summary</h3>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `Executive Summary — RiskGuard AI Risk Manager\n\nOver the past 30 days, ${totalCount.toLocaleString()} transactions were monitored across all accounts. ${flaggedCount.toLocaleString()} transactions (${highRiskPct}%) were flagged as high-risk and routed to the analyst queue. AI models detected ${activeAlerts} active alerts requiring immediate attention.\n\nKey findings:\n- Credential compromise remains the #1 risk vector, accounting for 92% of high-severity incidents.\n- Identity theft and synthetic identity fraud show a rising trend (+15% month-over-month).\n- The ensemble detection pipeline achieved 99.7% accuracy with a <0.3% false-positive rate.\n\nRecommended actions:\n1. Implement adaptive MFA for all high-value transaction paths.\n2. Increase monitoring thresholds for synthetic identity indicators.\n3. Schedule quarterly model retraining to maintain detection efficacy.\n\nPrepared by RiskGuard AI — ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`
                )
              }}
              className="flex items-center gap-1 text-xs text-accent hover:text-white transition-colors"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
          <div className="flex-1 text-sm text-navy-300 leading-relaxed space-y-3 overflow-y-auto max-h-64">
            <p>
              Over the past 30 days, <span className="text-white font-semibold">{totalCount.toLocaleString()}</span> transactions were monitored across all accounts. <span className="text-amber-400 font-semibold">{flaggedCount.toLocaleString()}</span> transactions (<span className="text-white font-semibold">{highRiskPct}%</span>) were flagged as high-risk and routed to the analyst queue. AI models detected <span className="text-purple-400 font-semibold">{activeAlerts}</span> active alerts requiring immediate attention.
            </p>
            <div>
              <p className="text-white font-semibold text-xs uppercase tracking-wider mb-1.5">Key Findings</p>
              <ul className="space-y-1 text-navy-300">
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" /> Credential compromise remains the #1 risk vector, accounting for 92% of high-severity incidents.</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" /> Identity theft and synthetic identity fraud show a rising trend (+15% month-over-month).</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" /> The ensemble detection pipeline achieved 99.7% accuracy with a &lt;0.3% false-positive rate.</li>
              </ul>
            </div>
            <div>
              <p className="text-white font-semibold text-xs uppercase tracking-wider mb-1.5">Recommended Actions</p>
              <ul className="space-y-1 text-navy-300">
                <li className="flex items-start gap-2"><span className="text-accent font-bold mt-0.5">1.</span> Implement adaptive MFA for all high-value transaction paths.</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold mt-0.5">2.</span> Increase monitoring thresholds for synthetic identity indicators.</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold mt-0.5">3.</span> Schedule quarterly model retraining to maintain detection efficacy.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Two-Column Layout ─── */}
      <div className="grid lg:grid-cols-[2fr_1fr] gap-5">
        {/* LEFT COLUMN */}
        <div className="space-y-5">
          {/* Risk Score Trend */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Risk Score Trend</h3>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gApproved" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10B981" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gFlagged" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} /><stop offset="95%" stopColor="#F59E0B" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gDeclined" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} /><stop offset="95%" stopColor="#EF4444" stopOpacity={0} /></linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: CHART_TOOLTIP.bg, border: `1px solid ${CHART_TOOLTIP.border}`, borderRadius: 12, color: CHART_TOOLTIP.text, fontSize: 12 }}
                  labelStyle={{ color: '#94A3B8' }}
                />
                <Area type="monotone" dataKey="approved" stroke="#10B981" fill="url(#gApproved)" strokeWidth={2} />
                <Area type="monotone" dataKey="flagged" stroke="#F59E0B" fill="url(#gFlagged)" strokeWidth={2} />
                <Area type="monotone" dataKey="declined" stroke="#EF4444" fill="url(#gDeclined)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-5 mt-3 text-xs text-navy-400">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />Approved</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />Flagged</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />Declined</span>
            </div>
          </div>

          {/* Top Risky Accounts */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Top Risky Accounts</h3>
              <Link to="/transactions" className="text-xs text-accent hover:underline flex items-center gap-1">View All <ExternalLink className="w-3 h-3" /></Link>
            </div>
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-navy-400 text-xs border-b border-white/5">
                    <th className="text-left font-medium pb-3 pr-4">User</th>
                    <th className="text-right font-medium pb-3 pr-4">Amount</th>
                    <th className="text-left font-medium pb-3 pr-4">Risk Score</th>
                    <th className="text-left font-medium pb-3 pr-4">Status</th>
                    <th className="text-left font-medium pb-3">Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {topRisky.map(tx => (
                    <tr key={tx.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] cursor-pointer transition-colors" onClick={() => window.location.href = '/transactions'}>
                      <td className="py-3 pr-4 text-white font-medium">{tx.user}</td>
                      <td className="py-3 pr-4 text-right text-navy-200">{formatCurrency(tx.amount)}</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-navy-700 overflow-hidden">
                            <div className={`h-full rounded-full ${riskScoreColor(tx.riskScore)}`} style={{ width: `${tx.riskScore}%` }} />
                          </div>
                          <span className="text-navy-200 text-xs">{tx.riskScore}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          tx.status === 'approved' ? 'bg-green-500/10 text-green-400' :
                          tx.status === 'declined' ? 'bg-red-500/10 text-red-400' :
                          tx.status === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-blue-500/10 text-blue-400'
                        }`}>{tx.status}</span>
                      </td>
                      <td className="py-3 text-navy-400 text-xs">{timeAgo(tx.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-5">
          {/* Risk Distribution Donut */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Risk Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: CHART_TOOLTIP.bg, border: `1px solid ${CHART_TOOLTIP.border}`, borderRadius: 12, color: CHART_TOOLTIP.text, fontSize: 12 }} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => <span className="text-navy-300 text-xs ml-1">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-center -mt-2">
              <span className="text-2xl font-bold text-white">{totalCount}</span>
              <p className="text-xs text-navy-400">Total Transactions</p>
            </div>
          </div>

          {/* Recent Alerts */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Recent Alerts</h3>
              <Link to="/alerts" className="text-xs text-accent hover:underline flex items-center gap-1">View All <ChevronRight className="w-3 h-3" /></Link>
            </div>
            <div className="space-y-3">
              {recentAlerts.map(alert => (
                <div key={alert.id} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/[0.03] transition-colors cursor-pointer">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${severityColor(alert.severity)}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{alert.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-navy-400">{timeAgo(alert.createdAt)}</span>
                      {alert.assignee && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-navy-700/60 text-navy-300">{alert.assignee}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {recentAlerts.length === 0 && <p className="text-sm text-navy-500 text-center py-4">No recent alerts</p>}
            </div>
          </div>

          {/* Model Performance */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Model Performance</h3>
            <div className="space-y-3">
              {activeModels.map(model => (
                <div key={model.id} className="p-3 rounded-xl bg-navy-800/40 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white font-medium">{model.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${model.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>{model.status}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 rounded-full bg-navy-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent to-purple transition-all duration-700"
                        style={{ width: `${model.accuracy ?? 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-navy-200 font-medium w-10 text-right">{model.accuracy != null ? `${model.accuracy.toFixed(1)}%` : 'N/A'}</span>
                  </div>
                </div>
              ))}
              {activeModels.length === 0 && <p className="text-sm text-navy-500 text-center py-4">No active models</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
