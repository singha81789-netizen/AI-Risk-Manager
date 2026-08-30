import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  Upload, Download, Search, X, ChevronLeft, ChevronRight,
  AlertTriangle, CheckCircle, Clock, Eye, ChevronUp, ChevronDown,
  FileText, ArrowRight, Ban, Shield
} from 'lucide-react'
import Papa from 'papaparse'
import { useApp } from '../contexts/AppContext'
import { uploadCsvFile } from '../services/api'
import type { Transaction, TransactionStatus, RiskLevel } from '../types'

type SortField = 'riskScore' | 'amount' | 'date' | 'id'
type SortDir = 'asc' | 'desc'

const ROWS_PER_PAGE = 10

const statusStyles: Record<TransactionStatus, string> = {
  approved: 'bg-green-500/15 text-green-400 border border-green-500/20',
  declined: 'bg-red-500/15 text-red-400 border border-red-500/20',
  pending: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  under_review: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
}

const statusLabels: Record<TransactionStatus, string> = {
  approved: 'Approved',
  declined: 'Declined',
  pending: 'Pending',
  under_review: 'Under Review',
}

function riskColor(score: number) {
  if (score >= 85) return 'bg-red-500'
  if (score >= 70) return 'bg-amber-500'
  return 'bg-green-500'
}

function riskTextColor(score: number) {
  if (score >= 85) return 'text-red-400'
  if (score >= 70) return 'text-amber-400'
  return 'text-green-400'
}

function formatCurrency(n: number) {
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function generateMockAiReasons(amount: number, location: string, riskScore: number): string[] {
  const reasons: string[] = []
  if (riskScore > 80) reasons.push('High risk score detected')
  if (amount > 10000) reasons.push('Unusual amount for this account')
  if (location.includes('RU') || location.includes('AE') || location.includes('TR')) reasons.push('High-risk jurisdiction')
  if (amount > 50000) reasons.push('Amount exceeds daily limit')
  if (riskScore > 60 && riskScore <= 80) reasons.push('Multiple risk factors combined')
  if (reasons.length === 0) reasons.push('Minor anomaly detected')
  return reasons
}

export default function Transactions() {
  const { transactions, addTransactions, addAuditEntry } = useApp()

  // Filter state
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [riskLevel, setRiskLevel] = useState<'all' | RiskLevel>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | TransactionStatus>('all')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')

  // Sort state
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Pagination
  const [page, setPage] = useState(1)

  // Detail drawer
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)

  // Upload modal
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<Record<string, string>[]>([])
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [toast, setToast] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  // Filtering
  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      if (search) {
        const q = search.toLowerCase()
        const match =
          tx.id.toLowerCase().includes(q) ||
          tx.user.toLowerCase().includes(q) ||
          tx.merchant.toLowerCase().includes(q) ||
          tx.location.toLowerCase().includes(q)
        if (!match) return false
      }
      if (dateFrom && tx.date < dateFrom) return false
      if (dateTo && tx.date.slice(0, 10) > dateTo) return false
      if (riskLevel !== 'all' && tx.riskLevel !== riskLevel) return false
      if (statusFilter !== 'all' && tx.status !== statusFilter) return false
      if (minAmount && tx.amount < parseFloat(minAmount)) return false
      if (maxAmount && tx.amount > parseFloat(maxAmount)) return false
      return true
    })
  }, [transactions, search, dateFrom, dateTo, riskLevel, statusFilter, minAmount, maxAmount])

  // Sorting
  const sorted = useMemo(() => {
    const copy = [...filtered]
    copy.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'riskScore': cmp = a.riskScore - b.riskScore; break
        case 'amount': cmp = a.amount - b.amount; break
        case 'date': cmp = a.date.localeCompare(b.date); break
        case 'id': cmp = a.id.localeCompare(b.id); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [filtered, sortField, sortDir])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / ROWS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * ROWS_PER_PAGE
  const pageRows = sorted.slice(pageStart, pageStart + ROWS_PER_PAGE)

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [search, dateFrom, dateTo, riskLevel, statusFilter, minAmount, maxAmount])

  const clearFilters = useCallback(() => {
    setSearch('')
    setDateFrom('')
    setDateTo('')
    setRiskLevel('all')
    setStatusFilter('all')
    setMinAmount('')
    setMaxAmount('')
  }, [])

  const handleSort = useCallback((field: SortField) => {
    setSortField(prev => {
      if (prev === field) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        return field
      }
      setSortDir('asc')
      return field
    })
  }, [])

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp className="w-3 h-3 text-navy-500" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-accent" />
      : <ChevronDown className="w-3 h-3 text-accent" />
  }

  // Export CSV
  const handleExport = useCallback(() => {
    const headers = ['ID', 'Date', 'Amount', 'User', 'Location', 'Category', 'Merchant', 'Card Type', 'Device Type', 'Risk Score', 'Risk Level', 'Status', 'Flagged', 'AI Reasons']
    const rows = sorted.map(tx => [
      tx.id, tx.date, tx.amount, tx.user, tx.location, tx.category,
      tx.merchant, tx.cardType, tx.deviceType, tx.riskScore, tx.riskLevel,
      tx.status, tx.flagged, tx.aiReasons.join('; ')
    ])
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `transactions_export_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    setToast('Exported successfully!')
    setTimeout(() => setToast(''), 3000)
  }, [sorted])

  // Upload handlers
  const openUpload = useCallback(() => {
    setCsvFile(null)
    setCsvPreview([])
    setImporting(false)
    setImportProgress(0)
    setShowUploadModal(true)
  }, [])

  const closeUpload = useCallback(() => {
    if (!importing) setShowUploadModal(false)
  }, [importing])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx'))) {
      setCsvFile(file)
      setCsvPreview([])
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setCsvFile(file)
      setCsvPreview([])
    }
  }, [])

  const parseCsv = useCallback(() => {
    if (!csvFile) return
    Papa.parse<Record<string, string>>(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvPreview(results.data.slice(0, 5))
      },
    })
  }, [csvFile])

  const doImport = useCallback(async () => {
    if (!csvFile) return
    setImporting(true)
    setImportProgress(0)
    try {
      setImportProgress(20)
      const result = await uploadCsvFile(csvFile)
      setImportProgress(80)

      const mapped: Transaction[] = (result.results || []).map((r: Record<string, unknown>, i: number) => ({
        id: (r.transaction_id as string) || `TXN-BATCH-${Date.now()}-${i}`,
        date: new Date().toISOString().replace('T', ' ').slice(0, 16),
        amount: (r.amount as number) || 0,
        user: `Customer ${(r.transaction_id as string) || i}`,
        location: 'Unknown',
        category: (r.merchant_category as string) || 'Other',
        riskScore: (r.risk_score as number) || 0,
        riskLevel: ((r.risk_level as string) || 'LOW') as RiskLevel,
        status: ((r.decision as string) === 'DECLINE' ? 'declined' : r.decision as string === 'REVIEW' ? 'under_review' : 'approved') as TransactionStatus,
        merchant: (r.merchant_category as string) || 'Unknown',
        cardType: 'Unknown',
        deviceType: 'Unknown',
        flagged: ((r.risk_score as number) || 0) >= 70,
        aiReasons: (r.triggered_risk_factors as string[]) || [],
      }))

      addTransactions(mapped)
      addAuditEntry({
        id: `AUD-${Date.now()}`,
        action: 'CSV Import',
        user: 'System',
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        details: `Imported ${mapped.length} transactions via CSV upload (${result.high_risk_count || 0} high-risk, ${result.medium_risk_count || 0} medium-risk, ${result.alerts_created || 0} alerts created)`,
        ipAddress: '127.0.0.1',
        module: 'Transactions',
      })
      setImportProgress(100)
      setImporting(false)
      setShowUploadModal(false)
      setToast(`Successfully imported ${mapped.length} transactions! ${result.high_risk_count || 0} flagged as high-risk.`)
      setTimeout(() => setToast(''), 3000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed'
      setImporting(false)
      setShowUploadModal(false)
      setToast(`Import error: ${msg}`)
      setTimeout(() => setToast(''), 4000)
    }
  }, [csvFile, addTransactions, addAuditEntry])

  // Quick action handlers for detail drawer
  const handleConfirmFraud = useCallback(() => {
    if (!selectedTx) return
    setToast(`Transaction ${selectedTx.id} confirmed as fraud`)
    setSelectedTx(null)
    setTimeout(() => setToast(''), 3000)
  }, [selectedTx])

  const handleDismissFalse = useCallback(() => {
    if (!selectedTx) return
    setToast(`Transaction ${selectedTx.id} dismissed as false positive`)
    setSelectedTx(null)
    setTimeout(() => setToast(''), 3000)
  }, [selectedTx])

  const handleEscalate = useCallback(() => {
    if (!selectedTx) return
    setToast(`Transaction ${selectedTx.id} escalated`)
    setSelectedTx(null)
    setTimeout(() => setToast(''), 3000)
  }, [selectedTx])

  const hasFilters = search || dateFrom || dateTo || riskLevel !== 'all' || statusFilter !== 'all' || minAmount || maxAmount

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-green-600 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-[slideUp_0.2s_ease]">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Transactions</h1>
          <p className="text-navy-300 text-sm mt-1">Monitor and analyze all transactions</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={openUpload} className="btn-primary flex items-center gap-2 text-sm">
            <Upload className="w-4 h-4" />
            Upload CSV
          </button>
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
            <input
              type="text"
              placeholder="Search by user, ID, merchant, location..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-9 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-navy-400 mb-1 block">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="input-field text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-navy-400 mb-1 block">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="input-field text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-navy-400 mb-1 block">Risk Level</label>
            <select
              value={riskLevel}
              onChange={e => setRiskLevel(e.target.value as 'all' | RiskLevel)}
              className="input-field text-sm"
            >
              <option value="all">All</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-navy-400 mb-1 block">Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as 'all' | TransactionStatus)}
              className="input-field text-sm"
            >
              <option value="all">All</option>
              <option value="approved">Approved</option>
              <option value="declined">Declined</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
            </select>
          </div>
        </div>
        <div className="flex items-end gap-3 mt-3">
          <div className="w-32">
            <label className="text-xs text-navy-400 mb-1 block">Min Amount</label>
            <input
              type="number"
              placeholder="0"
              value={minAmount}
              onChange={e => setMinAmount(e.target.value)}
              className="input-field text-sm"
            />
          </div>
          <div className="w-32">
            <label className="text-xs text-navy-400 mb-1 block">Max Amount</label>
            <input
              type="number"
              placeholder="∞"
              value={maxAmount}
              onChange={e => setMaxAmount(e.target.value)}
              className="input-field text-sm"
            />
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-xs text-navy-300 hover:text-white px-3 py-2 rounded-lg hover:bg-navy-700/50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Results Info */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-navy-300">
          Showing <span className="text-white font-medium">{sorted.length}</span> of{' '}
          <span className="text-white font-medium">{transactions.length}</span> transactions
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-navy-400">Sort by:</span>
          <select
            value={sortField}
            onChange={e => { setSortField(e.target.value as SortField); setSortDir('desc') }}
            className="input-field text-sm !w-auto !py-1.5"
          >
            <option value="date">Date</option>
            <option value="riskScore">Risk Score</option>
            <option value="amount">Amount</option>
            <option value="id">ID</option>
          </select>
          <button
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            className="p-1.5 rounded-lg bg-navy-800/60 border border-white/5 text-navy-300 hover:text-white transition-colors"
          >
            {sortDir === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="glass-card table-container overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-navy-400 text-xs border-b border-white/5">
              <th
                className="text-left font-medium py-3 px-4 cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('id')}
              >
                <span className="flex items-center gap-1">ID <SortIcon field="id" /></span>
              </th>
              <th
                className="text-left font-medium py-3 px-4 cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('date')}
              >
                <span className="flex items-center gap-1">Date <SortIcon field="date" /></span>
              </th>
              <th className="text-left font-medium py-3 px-4">User</th>
              <th
                className="text-right font-medium py-3 px-4 cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('amount')}
              >
                <span className="flex items-center justify-end gap-1">Amount <SortIcon field="amount" /></span>
              </th>
              <th className="text-left font-medium py-3 px-4">Location</th>
              <th className="text-left font-medium py-3 px-4">Category</th>
              <th
                className="text-left font-medium py-3 px-4 cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('riskScore')}
              >
                <span className="flex items-center gap-1">Risk Score <SortIcon field="riskScore" /></span>
              </th>
              <th className="text-left font-medium py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(tx => (
              <tr
                key={tx.id}
                className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] cursor-pointer transition-colors"
                onClick={() => setSelectedTx(tx)}
              >
                <td className="py-3 px-4 font-mono text-navy-200 text-xs">{tx.id}</td>
                <td className="py-3 px-4 text-navy-200 text-xs whitespace-nowrap">{tx.date}</td>
                <td className="py-3 px-4 text-white font-medium">{tx.user}</td>
                <td className="py-3 px-4 text-right font-bold text-white">{formatCurrency(tx.amount)}</td>
                <td className="py-3 px-4 text-navy-200 text-xs">{tx.location}</td>
                <td className="py-3 px-4 text-navy-200 text-xs">{tx.category}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-navy-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${riskColor(tx.riskScore)}`}
                        style={{ width: `${tx.riskScore}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium ${riskTextColor(tx.riskScore)}`}>{tx.riskScore}</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[tx.status]}`}>
                    {statusLabels[tx.status]}
                  </span>
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-navy-500">
                  No transactions match your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-navy-400">
          Page {safePage} of {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <button
            disabled={safePage <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
            .map((p, i, arr) => (
              <span key={p} className="flex items-center">
                {i > 0 && arr[i - 1] !== p - 1 && <span className="text-navy-600 px-1">...</span>}
                <button
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                    p === safePage
                      ? 'bg-accent text-white'
                      : 'text-navy-300 hover:bg-navy-700/50 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              </span>
            ))}
          <button
            disabled={safePage >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Transaction Detail Drawer */}
      {selectedTx && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            onClick={() => setSelectedTx(null)}
          />
          <div className="fixed top-0 right-0 bottom-0 w-96 bg-navy-900 border-l border-white/10 z-50 flex flex-col overflow-y-auto animate-[slideInRight_0.25s_ease]">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div>
                <h2 className="text-base font-bold text-white">{selectedTx.id}</h2>
                <p className="text-xs text-navy-400 mt-0.5">Transaction Detail</p>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="p-1.5 rounded-lg hover:bg-navy-700/50 text-navy-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Details Section */}
              <div>
                <h3 className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-3">Details</h3>
                <div className="space-y-2.5">
                  {[
                    { label: 'Amount', value: formatCurrency(selectedTx.amount), bold: true },
                    { label: 'Date', value: selectedTx.date },
                    { label: 'User', value: selectedTx.user },
                    { label: 'Location', value: selectedTx.location },
                    { label: 'Merchant', value: selectedTx.merchant },
                    { label: 'Category', value: selectedTx.category },
                    { label: 'Card Type', value: selectedTx.cardType },
                    { label: 'Device Type', value: selectedTx.deviceType },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-xs text-navy-400">{item.label}</span>
                      <span className={`text-xs ${item.bold ? 'text-white font-bold' : 'text-navy-200'}`}>{item.value}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-navy-400">Status</span>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[selectedTx.status]}`}>
                      {statusLabels[selectedTx.status]}
                    </span>
                  </div>
                </div>
              </div>

              {/* AI Risk Analysis Section */}
              <div>
                <h3 className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-3">AI Risk Analysis</h3>
                <div className="space-y-4">
                  {/* Risk Score */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-navy-300">Risk Score</span>
                      <span className={`text-lg font-bold ${riskTextColor(selectedTx.riskScore)}`}>{selectedTx.riskScore}/100</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-navy-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${riskColor(selectedTx.riskScore)} transition-all duration-500`}
                        style={{ width: `${selectedTx.riskScore}%` }}
                      />
                    </div>
                  </div>

                  {/* Risk Level & Fraud Probability */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-navy-800/50 border border-white/5">
                      <span className="text-[10px] text-navy-400 uppercase tracking-wider block mb-1">Risk Level</span>
                      <span className={`text-sm font-bold ${
                        selectedTx.riskLevel === 'HIGH' ? 'text-red-400' :
                        selectedTx.riskLevel === 'MEDIUM' ? 'text-amber-400' : 'text-green-400'
                      }`}>{selectedTx.riskLevel}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-navy-800/50 border border-white/5">
                      <span className="text-[10px] text-navy-400 uppercase tracking-wider block mb-1">Fraud Probability</span>
                      <span className="text-sm font-bold text-white">{Math.min(99, selectedTx.riskScore + Math.floor(Math.random() * 5))}%</span>
                    </div>
                  </div>

                  {/* Why Flagged */}
                  {selectedTx.aiReasons.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-white mb-2">Why Flagged?</h4>
                      <ul className="space-y-1.5">
                        {selectedTx.aiReasons.map((reason, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-navy-300">
                            <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Contributing Factors Bar Chart */}
                  <div>
                    <h4 className="text-xs font-semibold text-white mb-2">Contributing Factors</h4>
                    <div className="space-y-2">
                      {[
                        { label: 'Location', value: 35, color: 'bg-blue-500' },
                        { label: 'Amount', value: 28, color: 'bg-amber-500' },
                        { label: 'Velocity', value: 22, color: 'bg-purple-500' },
                        { label: 'Device', value: 15, color: 'bg-navy-400' },
                      ].map(f => (
                        <div key={f.label} className="flex items-center gap-3">
                          <span className="text-[10px] text-navy-400 w-14 text-right">{f.label}</span>
                          <div className="flex-1 h-2 rounded-full bg-navy-700 overflow-hidden">
                            <div className={`h-full rounded-full ${f.color}`} style={{ width: `${f.value}%` }} />
                          </div>
                          <span className="text-[10px] text-navy-300 w-8 text-right">{f.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={handleConfirmFraud}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-red-500/15 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/25 transition-colors"
                >
                  <Ban className="w-4 h-4" />
                  Confirm Fraud
                </button>
                <button
                  onClick={handleDismissFalse}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-green-500/15 border border-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/25 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Dismiss False Positive
                </button>
                <button
                  onClick={handleEscalate}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/25 transition-colors"
                >
                  <Shield className="w-4 h-4" />
                  Escalate
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* CSV Upload Modal */}
      {showUploadModal && (
        <>
          <div className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm" onClick={closeUpload} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-navy-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg pointer-events-auto animate-[slideUp_0.25s_ease]">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Upload CSV</h2>
                    <p className="text-xs text-navy-400">Import transactions from a CSV file</p>
                  </div>
                </div>
                <button
                  onClick={closeUpload}
                  disabled={importing}
                  className="p-1.5 rounded-lg hover:bg-navy-700/50 text-navy-400 hover:text-white transition-colors disabled:opacity-40"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* Drag and Drop Zone */}
                {!csvFile ? (
                  <div
                    ref={dropRef}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-navy-600 hover:border-accent rounded-xl p-10 text-center cursor-pointer transition-colors group"
                  >
                    <Upload className="w-10 h-10 text-navy-500 group-hover:text-accent mx-auto mb-3 transition-colors" />
                    <p className="text-sm text-navy-300 group-hover:text-white transition-colors">
                      Drop CSV file here or click to browse
                    </p>
                    <p className="text-xs text-navy-500 mt-1">Accepts .csv and .xlsx files</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* File Info */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-navy-800/50 border border-white/5">
                      <FileText className="w-5 h-5 text-accent flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{csvFile.name}</p>
                        <p className="text-xs text-navy-400">{formatFileSize(csvFile.size)}</p>
                      </div>
                      {!importing && (
                        <button
                          onClick={() => { setCsvFile(null); setCsvPreview([]) }}
                          className="p-1 rounded-lg hover:bg-navy-700/50 text-navy-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Preview Table */}
                    {csvPreview.length > 0 && (
                      <div className="max-h-48 overflow-auto rounded-xl border border-white/5">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-navy-800/60 text-navy-300">
                              {Object.keys(csvPreview[0]).map(key => (
                                <th key={key} className="px-3 py-2 text-left font-medium whitespace-nowrap">{key}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {csvPreview.map((row, i) => (
                              <tr key={i} className="border-t border-white/5">
                                {Object.values(row).map((val, j) => (
                                  <td key={j} className="px-3 py-2 text-navy-200 whitespace-nowrap max-w-[120px] truncate">{val}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Progress Bar */}
                    {importing && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-navy-300">Importing...</span>
                          <span className="text-xs text-accent font-medium">{importProgress}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-navy-700 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-accent transition-all duration-150"
                            style={{ width: `${importProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 mt-6">
                  <button
                    onClick={closeUpload}
                    disabled={importing}
                    className="btn-secondary text-sm disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  {!csvPreview.length && csvFile && !importing && (
                    <button onClick={parseCsv} className="btn-primary text-sm flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Parse & Preview
                    </button>
                  )}
                  {csvPreview.length > 0 && !importing && (
                    <button onClick={doImport} className="btn-primary text-sm flex items-center gap-2">
                      <ArrowRight className="w-4 h-4" />
                      Import Transactions
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}