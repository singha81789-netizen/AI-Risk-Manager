import { useState, useMemo, useCallback } from 'react'
import { Download, Search, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { useApp } from '../contexts/AppContext'

const MODULES = ['All', 'Alert', 'Transaction', 'Settings', 'Model', 'Report']

const moduleColor: Record<string, string> = {
  Alert: 'bg-red-500/15 text-red-400 border border-red-500/20',
  Transaction: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  Settings: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  Model: 'bg-purple-500/15 text-purple-400 border border-purple-500/20',
  Report: 'bg-green-500/15 text-green-400 border border-green-500/20',
  Auth: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20',
  Transactions: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  Alerts: 'bg-red-500/15 text-red-400 border border-red-500/20',
}

const PAGE_SIZE = 20

function formatTimestamp(ts: string) {
  const d = new Date(ts.replace(' ', 'T'))
  return d.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function getInitial(name: string) {
  return name.charAt(0).toUpperCase()
}

export default function AuditLog() {
  const { auditLog } = useApp()

  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [selectedUser, setSelectedUser] = useState('All')
  const [actionSearch, setActionSearch] = useState('')
  const [selectedModule, setSelectedModule] = useState('All')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState('')

  const uniqueUsers = useMemo(() => {
    const users = new Set(auditLog.map(e => e.user))
    return ['All', ...Array.from(users).sort()]
  }, [auditLog])

  const filtered = useMemo(() => {
    let result = [...auditLog]
    if (dateStart) result = result.filter(e => e.timestamp >= dateStart)
    if (dateEnd) result = result.filter(e => e.timestamp <= dateEnd + 'T23:59')
    if (selectedUser !== 'All') result = result.filter(e => e.user === selectedUser)
    if (actionSearch) {
      const q = actionSearch.toLowerCase()
      result = result.filter(e => e.action.toLowerCase().includes(q) || e.details.toLowerCase().includes(q))
    }
    if (selectedModule !== 'All') result = result.filter(e => e.module === selectedModule)
    result.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    return result
  }, [auditLog, dateStart, dateEnd, selectedUser, actionSearch, selectedModule])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const handleExport = useCallback(() => {
    const header = 'Timestamp,User,Action,Module,Details,IP Address\n'
    const rows = filtered.map(e =>
      `"${e.timestamp}","${e.user}","${e.action}","${e.module}","${e.details}","${e.ipAddress}"`
    ).join('\n')
    const csv = header + rows
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setToast('Audit log exported as CSV')
    setTimeout(() => setToast(''), 3000)
  }, [filtered])

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-green-600 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-[slideUp_0.2s_ease]">
          {toast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Log</h1>
          <p className="text-navy-300 text-sm mt-1">Track all system and user actions</p>
        </div>
        <button onClick={handleExport} className="btn-secondary text-sm flex items-center gap-2">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <div className="glass-card p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-navy-400 mb-1 block">Start Date</label>
            <input
              type="date"
              value={dateStart}
              onChange={e => { setDateStart(e.target.value); setPage(1) }}
              className="input-field text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-navy-400 mb-1 block">End Date</label>
            <input
              type="date"
              value={dateEnd}
              onChange={e => { setDateEnd(e.target.value); setPage(1) }}
              className="input-field text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-navy-400 mb-1 block">User</label>
            <div className="relative">
              <select
                value={selectedUser}
                onChange={e => { setSelectedUser(e.target.value); setPage(1) }}
                className="input-field text-sm appearance-none pr-7"
              >
                {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-xs text-navy-400 mb-1 block">Action Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
              <input
                type="text"
                placeholder="Search actions..."
                value={actionSearch}
                onChange={e => { setActionSearch(e.target.value); setPage(1) }}
                className="input-field text-sm pl-9"
              />
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-navy-400">Module:</span>
          {MODULES.map(m => (
            <button
              key={m}
              onClick={() => { setSelectedModule(m); setPage(1) }}
              className={`px-3 py-1 text-xs rounded-lg transition-colors font-medium ${
                selectedModule === m ? 'bg-accent text-white' : 'bg-navy-800/60 text-navy-300 hover:text-white'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Timestamp', 'User', 'Action', 'Module', 'Details', 'IP Address'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-navy-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(entry => (
                <tr key={entry.id} className="border-b border-white/5 hover:bg-navy-800/30 transition-colors">
                  <td className="py-3 px-4 text-navy-300 text-xs whitespace-nowrap">{formatTimestamp(entry.timestamp)}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center text-xs font-bold text-accent">
                        {getInitial(entry.user)}
                      </div>
                      <span className="text-white text-xs">{entry.user}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-white text-xs font-medium">{entry.action}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${moduleColor[entry.module] || 'bg-navy-500/15 text-navy-300'}`}>
                      {entry.module}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-navy-300 text-xs max-w-[280px] truncate">{entry.details}</td>
                  <td className="py-3 px-4 text-navy-400 text-xs font-mono">{entry.ipAddress}</td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-navy-400 text-sm">No audit entries match your filters</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
          <span className="text-xs text-navy-400">
            Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg bg-navy-800/60 border border-white/5 text-navy-300 hover:text-white disabled:opacity-30 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number
              if (totalPages <= 5) pageNum = i + 1
              else if (page <= 3) pageNum = i + 1
              else if (page >= totalPages - 2) pageNum = totalPages - 4 + i
              else pageNum = page - 2 + i
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                    page === pageNum ? 'bg-accent text-white' : 'text-navy-300 hover:text-white'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg bg-navy-800/60 border border-white/5 text-navy-300 hover:text-white disabled:opacity-30 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
