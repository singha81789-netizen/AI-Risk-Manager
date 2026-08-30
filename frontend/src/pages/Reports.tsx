import { useState, useMemo, useCallback } from 'react'
import {
  FilePlus, Download, Eye, Calendar, Clock, FileText, ChevronDown, Plus, X, Check, Loader2
} from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import { downloadPdfReport, downloadCsvReport, getReportSummary } from '../services/api'

const REPORT_TYPES = [
  'Monthly Fraud Summary',
  'Weekly Risk Analysis',
  'High Risk Transaction Report',
  'Model Performance Review',
]

const CATEGORIES = ['All', 'Electronics', 'Travel', 'Shopping', 'Food & Dining', 'Entertainment', 'Utilities']

const typeBadge: Record<string, string> = {
  'Monthly Fraud Summary': 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  'Weekly Risk Analysis': 'bg-purple-500/15 text-purple-400 border border-purple-500/20',
  'High Risk Transaction Report': 'bg-red-500/15 text-red-400 border border-red-500/20',
  'Model Performance Review': 'bg-green-500/15 text-green-400 border border-green-500/20',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Reports() {
  const { reports, addReport, auditLog, addAuditEntry, scheduledReports } = useApp()

  const [reportType, setReportType] = useState(REPORT_TYPES[0])
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [category, setCategory] = useState('All')
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf')
  const [toast, setToast] = useState('')
  const [generating, setGenerating] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [scheduleName, setScheduleName] = useState('')
  const [scheduleFreq, setScheduleFreq] = useState('Monthly')
  const [scheduleRecipients, setScheduleRecipients] = useState('')
  const [schedules, setSchedules] = useState(scheduledReports)
  const [scheduleToggles, setScheduleToggles] = useState<Record<string, boolean>>(
    () => Object.fromEntries(scheduledReports.map(s => [s.id, s.active]))
  )

  const totalCount = reports.length
  const thisMonth = useMemo(() => {
    const now = new Date()
    return reports.filter(r => {
      const d = new Date(r.date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
  }, [reports])
  const scheduledCount = useMemo(() => schedules.filter(s => scheduleToggles[s.id] !== false).length, [schedules, scheduleToggles])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }, [])

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    try {
      const days = dateStart && dateEnd
        ? Math.max(1, Math.round((new Date(dateEnd).getTime() - new Date(dateStart).getTime()) / 86400000))
        : 30
      const summary = await getReportSummary(days)
      const now = new Date()
      const newReport = {
        id: 'RPT-' + Date.now(),
        title: reportType,
        type: reportType,
        date: now.toISOString().slice(0, 10),
        status: 'Completed',
        size: `${((summary as Record<string, unknown>).total_transactions as number || 0) * 0.002 + 0.5} MB`,
        days,
        format,
      }
      addReport(newReport)
      addAuditEntry({
        id: 'AUD-' + Date.now(),
        action: 'Report Generated',
        user: 'You',
        timestamp: now.toISOString().replace('T', ' ').slice(0, 16),
        details: `Generated ${reportType} (${format.toUpperCase()}) — ${(summary as Record<string, unknown>).total_transactions || 0} transactions analyzed`,
        ipAddress: '127.0.0.1',
        module: 'Report',
      })

      if (format === 'pdf') {
        const blob = await downloadPdfReport(days)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${reportType.replace(/\s+/g, '_')}_${now.toISOString().slice(0, 10)}.pdf`
        a.click()
        URL.revokeObjectURL(url)
        showToast(`${reportType} generated and downloaded as PDF`)
      } else {
        const blob = await downloadCsvReport(days)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${reportType.replace(/\s+/g, '_')}_${now.toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
        showToast(`${reportType} generated and downloaded as CSV`)
      }

      setDateStart('')
      setDateEnd('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate report'
      showToast(`Error: ${msg}`)
    } finally {
      setGenerating(false)
    }
  }, [reportType, format, dateStart, dateEnd, addReport, addAuditEntry, showToast])

  const handleAddSchedule = useCallback(() => {
    if (!scheduleName.trim()) return
    const newSchedule = {
      id: 'SCH-' + Date.now(),
      name: scheduleName.trim(),
      frequency: scheduleFreq,
      recipients: scheduleRecipients.split(',').map(e => e.trim()).filter(Boolean),
      nextRun: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      active: true,
    }
    setSchedules(prev => [...prev, newSchedule])
    setScheduleToggles(prev => ({ ...prev, [newSchedule.id]: true }))
    addAuditEntry({
      id: 'AUD-' + Date.now(),
      action: 'Schedule Created',
      user: 'You',
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      details: `Scheduled report: ${newSchedule.name} (${newSchedule.frequency})`,
      ipAddress: '127.0.0.1',
      module: 'Report',
    })
    showToast('Schedule added')
    setScheduleName('')
    setScheduleRecipients('')
    setShowScheduleForm(false)
  }, [scheduleName, scheduleFreq, scheduleRecipients, addAuditEntry, showToast])

  const toggleSchedule = useCallback((id: string) => {
    setScheduleToggles(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const handleDownloadPdf = useCallback(async (report: typeof reports[0]) => {
    setDownloading(report.id + '-pdf')
    try {
      const days = report.days || 30
      const blob = await downloadPdfReport(days)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${report.title.replace(/\s+/g, '_')}_${report.date}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      addAuditEntry({
        id: 'AUD-' + Date.now(),
        action: 'Report Downloaded',
        user: 'You',
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        details: `Downloaded ${report.title} as PDF`,
        ipAddress: '127.0.0.1',
        module: 'Report',
      })
      showToast('PDF report downloaded')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Download failed'
      showToast(`Error: ${msg}`)
    } finally {
      setDownloading(null)
    }
  }, [addAuditEntry, showToast])

  const handleDownloadExcel = useCallback(async (report: typeof reports[0]) => {
    setDownloading(report.id + '-csv')
    try {
      const days = report.days || 30
      const blob = await downloadCsvReport(days)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${report.title.replace(/\s+/g, '_')}_${report.date}.csv`
      a.click()
      URL.revokeObjectURL(url)
      addAuditEntry({
        id: 'AUD-' + Date.now(),
        action: 'Report Downloaded',
        user: 'You',
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        details: `Downloaded ${report.title} as Excel`,
        ipAddress: '127.0.0.1',
        module: 'Report',
      })
      showToast('CSV report downloaded')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Download failed'
      showToast(`Error: ${msg}`)
    } finally {
      setDownloading(null)
    }
  }, [addAuditEntry, showToast])

  const statCards = [
    { label: 'Total Reports', value: totalCount, bg: 'bg-blue-500/15', iconColor: 'text-blue-400' },
    { label: 'This Month', value: thisMonth, bg: 'bg-green-500/15', iconColor: 'text-green-400' },
    { label: 'Scheduled', value: scheduledCount, bg: 'bg-purple-500/15', iconColor: 'text-purple-400' },
  ]

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-green-600 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-[slideUp_0.2s_ease]">
          {toast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-navy-300 text-sm mt-1">Generate and download analytical reports</p>
        </div>
        <button onClick={handleGenerate} disabled={generating} className="btn-primary flex items-center gap-2 text-sm">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FilePlus className="w-4 h-4" />}
          {generating ? 'Generating...' : 'Generate Report'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {statCards.map(sc => (
          <div key={sc.label} className="glass-card p-5 group hover:shadow-lg transition-all duration-300">
            <div className="text-2xl font-bold text-white mb-0.5">{sc.value}</div>
            <div className="text-xs text-navy-400">{sc.label}</div>
          </div>
        ))}
      </div>

      <div className="glass-card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white">Generate Report</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-navy-400 mb-1 block">Report Type</label>
            <div className="relative">
              <select
                value={reportType}
                onChange={e => setReportType(e.target.value)}
                className="input-field text-sm appearance-none pr-7"
              >
                {REPORT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-xs text-navy-400 mb-1 block">Start Date</label>
            <input
              type="date"
              value={dateStart}
              onChange={e => setDateStart(e.target.value)}
              className="input-field text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-navy-400 mb-1 block">End Date</label>
            <input
              type="date"
              value={dateEnd}
              onChange={e => setDateEnd(e.target.value)}
              className="input-field text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-navy-400 mb-1 block">Category</label>
            <div className="relative">
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="input-field text-sm appearance-none pr-7"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400 pointer-events-none" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-navy-400">Format:</span>
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            <button
              onClick={() => setFormat('pdf')}
              className={`px-4 py-1.5 text-xs font-medium transition-colors ${format === 'pdf' ? 'bg-accent text-white' : 'bg-navy-800/60 text-navy-300 hover:text-white'}`}
            >
              PDF
            </button>
            <button
              onClick={() => setFormat('excel')}
              className={`px-4 py-1.5 text-xs font-medium transition-colors ${format === 'excel' ? 'bg-accent text-white' : 'bg-navy-800/60 text-navy-300 hover:text-white'}`}
            >
              Excel
            </button>
          </div>
        </div>
        <button onClick={handleGenerate} disabled={generating} className="btn-primary text-sm flex items-center gap-2">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          {generating ? 'Generating...' : 'Generate Now'}
        </button>
      </div>

      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Scheduled Reports</h2>
          <button
            onClick={() => setShowScheduleForm(!showScheduleForm)}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            {showScheduleForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {showScheduleForm ? 'Cancel' : 'Add Schedule'}
          </button>
        </div>

        {showScheduleForm && (
          <div className="p-4 rounded-xl bg-navy-800/40 border border-white/5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Schedule name"
                value={scheduleName}
                onChange={e => setScheduleName(e.target.value)}
                className="input-field text-sm"
              />
              <div className="relative">
                <select
                  value={scheduleFreq}
                  onChange={e => setScheduleFreq(e.target.value)}
                  className="input-field text-sm appearance-none pr-7"
                >
                  <option>Daily</option>
                  <option>Weekly</option>
                  <option>Monthly</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400 pointer-events-none" />
              </div>
              <input
                type="text"
                placeholder="Recipients (comma-separated)"
                value={scheduleRecipients}
                onChange={e => setScheduleRecipients(e.target.value)}
                className="input-field text-sm"
              />
            </div>
            <button onClick={handleAddSchedule} className="btn-primary text-xs">Add Schedule</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Report Name', 'Frequency', 'Recipients', 'Next Run', 'Status'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-navy-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedules.map(s => (
                <tr key={s.id} className="border-b border-white/5 hover:bg-navy-800/30 transition-colors">
                  <td className="py-3 px-3 text-white font-medium">{s.name}</td>
                  <td className="py-3 px-3 text-navy-300">{s.frequency}</td>
                  <td className="py-3 px-3 text-navy-300">{s.recipients.join(', ')}</td>
                  <td className="py-3 px-3 text-navy-300">{formatDate(s.nextRun)}</td>
                  <td className="py-3 px-3">
                    <button
                      onClick={() => toggleSchedule(s.id)}
                      className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${scheduleToggles[s.id] !== false ? 'bg-accent' : 'bg-navy-600'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${scheduleToggles[s.id] !== false ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white">Report History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Report Title', 'Type', 'Date', 'Status', 'Size', 'Actions'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-navy-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map(r => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-navy-800/30 transition-colors">
                  <td className="py-3 px-3 text-white font-medium">{r.title}</td>
                  <td className="py-3 px-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${typeBadge[r.type] || 'bg-navy-500/15 text-navy-300'}`}>
                      {r.type}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-navy-300">{formatDate(r.date)}</td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/20">
                      <Check className="w-3 h-3" /> {r.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-navy-300">{r.size}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleDownloadPdf(r)}
                        disabled={downloading === r.id + '-pdf'}
                        className="p-1.5 rounded-lg bg-navy-800/60 border border-white/5 text-navy-300 hover:text-white hover:bg-navy-700/60 transition-all disabled:opacity-50"
                        title="Download PDF"
                      >
                        {downloading === r.id + '-pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleDownloadExcel(r)}
                        disabled={downloading === r.id + '-csv'}
                        className="p-1.5 rounded-lg bg-navy-800/60 border border-white/5 text-navy-300 hover:text-white hover:bg-navy-700/60 transition-all disabled:opacity-50"
                        title="Download Excel"
                      >
                        {downloading === r.id + '-csv' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        className="p-1.5 rounded-lg bg-navy-800/60 border border-white/5 text-navy-300 hover:text-white hover:bg-navy-700/60 transition-all"
                        title="View"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
