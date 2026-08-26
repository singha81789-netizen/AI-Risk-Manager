import { useState, useMemo, useCallback } from 'react'
import {
  Brain, Target, Zap, RefreshCw, ChevronDown, Upload, Play, RotateCcw, X,
  BarChart3
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useApp } from '../contexts/AppContext'
import type { AiModel, ModelStatus } from '../types'

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K'
  return n.toString()
}

const MODEL_COLORS = ['#4F6DF5', '#10B981', '#F59E0B', '#EF4444', '#7C3AED', '#38BDF8']

const CHART_TOOLTIP = { bg: '#1E293B', border: '#2A3550', text: '#F8FAFC' }

export default function AIModels() {
  const { models, retrainModel, updateModelStatus } = useApp()

  const [showComparison, setShowComparison] = useState(false)
  const [retraining, setRetraining] = useState<string | null>(null)
  const [uploadExpanded, setUploadExpanded] = useState(false)
  const [uploadTarget, setUploadTarget] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [toast, setToast] = useState('')

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }, [])

  // Stats
  const activeModels = useMemo(() => models.filter(m => m.status === 'active'), [models])
  const trainingModels = useMemo(() => models.filter(m => m.status === 'training'), [models])
  const avgAccuracy = useMemo(() => {
    const withAcc = activeModels.filter(m => m.accuracy != null)
    if (withAcc.length === 0) return 0
    return withAcc.reduce((s, m) => s + (m.accuracy ?? 0), 0) / withAcc.length
  }, [activeModels])

  const statCards = [
    { label: 'Active Models', value: activeModels.length, icon: Brain, bg: 'bg-blue-500/15', iconColor: 'text-blue-400' },
    { label: 'Avg Accuracy', value: `${avgAccuracy.toFixed(1)}%`, icon: Target, bg: 'bg-green-500/15', iconColor: 'text-green-400' },
    { label: 'Total Predictions', value: '1.2M', icon: Zap, bg: 'bg-amber-500/15', iconColor: 'text-amber-400' },
    { label: 'Training', value: trainingModels.length, icon: RefreshCw, bg: 'bg-purple-500/15', iconColor: 'text-purple-400', spinning: trainingModels.length > 0 },
  ]

  // Comparison chart data
  const comparisonData = useMemo(() => {
    const days = 7
    return Array.from({ length: days }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (days - 1 - i))
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const entry: Record<string, string | number> = { date: dateStr }
      activeModels.forEach((m, mi) => {
        const base = m.accuracy ?? 90
        const seed = i * 3 + mi * 7
        entry[m.name] = Math.min(99.9, base + Math.sin(seed) * 2 + i * 0.1)
      })
      return entry
    })
  }, [activeModels])

  const handleRetrain = useCallback((modelId: string) => {
    retrainModel(modelId)
    setRetraining(modelId)
    setTimeout(() => {
      setRetraining(null)
      showToast('Model retrained successfully')
    }, 2100)
  }, [retrainModel, showToast])

  const handleToggleStatus = useCallback((modelId: string, currentStatus: ModelStatus) => {
    const newStatus: ModelStatus = currentStatus === 'active' ? 'inactive' : 'active'
    updateModelStatus(modelId, newStatus)
    showToast(`Model ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
  }, [updateModelStatus, showToast])

  const handleRollback = useCallback((modelId: string) => {
    showToast(`Model ${modelId} rolled back to previous version`)
  }, [showToast])

  const handleStartTraining = useCallback(() => {
    if (!uploadTarget || !uploadFile) return
    setUploading(true)
    setUploadProgress(0)
    const interval = setInterval(() => {
      setUploadProgress(p => {
        if (p >= 100) {
          clearInterval(interval)
          updateModelStatus(uploadTarget, 'training')
          setTimeout(() => {
            updateModelStatus(uploadTarget, 'active')
            setUploading(false)
            setUploadFile(null)
            setUploadProgress(0)
            showToast('Training completed successfully')
          }, 3000)
          return 100
        }
        return p + 8
      })
    }, 150)
  }, [uploadTarget, uploadFile, updateModelStatus, showToast])

  const typeBadge = (type: string) => {
    if (type.includes('Gradient') || type.includes('LSTM')) return 'bg-accent/15 text-accent border border-accent/20'
    if (type.includes('Ensemble')) return 'bg-purple/15 text-purple border border-purple/20'
    return 'bg-navy-500/15 text-navy-300 border border-navy-500/20'
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-green-600 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-[slideUp_0.2s_ease]">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Models</h1>
          <p className="text-navy-300 text-sm mt-1">Manage and monitor your AI/ML models</p>
        </div>
        <button
          onClick={() => setShowComparison(!showComparison)}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <BarChart3 className="w-4 h-4" />
          {showComparison ? 'Hide Comparison' : 'Compare Models'}
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(sc => (
          <div key={sc.label} className="glass-card p-5 group hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${sc.bg} flex items-center justify-center`}>
                <sc.icon className={`w-5 h-5 ${sc.iconColor} ${sc.spinning ? 'animate-spin' : ''}`} />
              </div>
            </div>
            <div className="text-2xl font-bold text-white mb-0.5">{sc.value}</div>
            <div className="text-xs text-navy-400">{sc.label}</div>
          </div>
        ))}
      </div>

      {/* Comparison View */}
      {showComparison && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Model Accuracy Comparison (7 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={comparisonData} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[85, 100]} tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: CHART_TOOLTIP.bg, border: `1px solid ${CHART_TOOLTIP.border}`, borderRadius: 12, color: CHART_TOOLTIP.text, fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} formatter={(value: string) => <span className="text-navy-300 text-xs ml-1">{value}</span>} />
              {activeModels.map((m, i) => (
                <Line key={m.id} type="monotone" dataKey={m.name} stroke={MODEL_COLORS[i % MODEL_COLORS.length]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Model Cards Grid */}
      <div className="grid md:grid-cols-2 gap-5">
        {models.map(model => (
          <div key={model.id} className="glass-card p-5 space-y-4 hover:shadow-lg transition-all duration-300">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">{model.name}</h3>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${typeBadge(model.type)}`}>
                  {model.type}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${model.status === 'active' ? 'bg-green-500' : model.status === 'training' ? 'bg-amber-500' : 'bg-navy-500'}`} />
                <span className={`text-xs font-medium ${model.status === 'active' ? 'text-green-400' : model.status === 'training' ? 'text-amber-400' : 'text-navy-400'}`}>
                  {model.status === 'active' ? 'Active' : model.status === 'training' ? 'Training' : 'Inactive'}
                </span>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-navy-300">{model.description}</p>

            {/* Metrics */}
            {model.accuracy != null && (
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Accuracy', value: `${model.accuracy}%` },
                  { label: 'Precision', value: `${model.precision}%` },
                  { label: 'Recall', value: `${model.recall}%` },
                  { label: 'F1 Score', value: `${model.f1Score}%` },
                ].map(m => (
                  <div key={m.label} className="p-2 rounded-xl bg-navy-800/50 border border-white/5 text-center">
                    <div className="text-[10px] text-navy-400 mb-0.5">{m.label}</div>
                    <div className="text-xs font-bold text-white">{m.value}</div>
                  </div>
                ))}
              </div>
            )}
            {model.accuracy == null && (
              <div className="p-3 rounded-xl bg-navy-800/50 border border-white/5 text-center">
                <span className="text-xs text-navy-400">Metrics pending training completion</span>
              </div>
            )}

            {/* Meta */}
            <div className="flex items-center gap-4 text-xs text-navy-400">
              <span>Last trained: {formatDate(model.lastTrained)}</span>
              <span>Training size: {formatNumber(model.trainingSize)}</span>
            </div>

            {/* Feature Importance */}
            {model.featureImportance.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-3">Feature Importance</h4>
                <div className="space-y-2">
                  {model.featureImportance.map(fi => (
                    <div key={fi.feature} className="flex items-center gap-3">
                      <span className="text-[10px] text-navy-300 w-28 text-right truncate">{fi.feature}</span>
                      <div className="flex-1 h-2 rounded-full bg-navy-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-accent to-purple transition-all duration-500"
                          style={{ width: `${fi.importance * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-navy-300 w-10 text-right">{(fi.importance * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => handleRetrain(model.id)}
                disabled={retraining === model.id || model.status === 'training'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/15 border border-accent/20 text-accent text-xs font-medium hover:bg-accent/25 transition-colors disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${retraining === model.id ? 'animate-spin' : ''}`} />
                {retraining === model.id ? 'Retraining...' : 'Retrain'}
              </button>
              <button
                onClick={() => handleToggleStatus(model.id, model.status)}
                disabled={model.status === 'training'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-700/50 border border-white/5 text-navy-200 text-xs font-medium hover:bg-navy-600/50 transition-colors disabled:opacity-40"
              >
                {model.status === 'active' ? 'Deactivate' : 'Deploy'}
              </button>
              {model.status === 'active' && (
                <button
                  onClick={() => handleRollback(model.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-700/50 border border-white/5 text-navy-200 text-xs font-medium hover:bg-navy-600/50 transition-colors ml-auto"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Rollback
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Upload Training Data */}
      <div className="glass-card overflow-hidden">
        <button
          onClick={() => setUploadExpanded(!uploadExpanded)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
              <Upload className="w-5 h-5 text-accent" />
            </div>
            <span className="text-sm font-semibold text-white">Upload Training Dataset</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-navy-400 transition-transform duration-200 ${uploadExpanded ? 'rotate-180' : ''}`} />
        </button>

        {uploadExpanded && (
          <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
            {/* Drop Zone */}
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault()
                const file = e.dataTransfer.files[0]
                if (file) setUploadFile(file)
              }}
              onClick={() => document.getElementById('training-upload')?.click()}
              className="border-2 border-dashed border-navy-600 hover:border-accent rounded-xl p-8 text-center cursor-pointer transition-colors group"
            >
              <Upload className="w-8 h-8 text-navy-500 group-hover:text-accent mx-auto mb-2 transition-colors" />
              {uploadFile ? (
                <div>
                  <p className="text-sm text-white font-medium">{uploadFile.name}</p>
                  <p className="text-xs text-navy-400 mt-1">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                  <button
                    onClick={e => { e.stopPropagation(); setUploadFile(null) }}
                    className="mt-2 text-xs text-navy-400 hover:text-white flex items-center gap-1 mx-auto"
                  >
                    <X className="w-3 h-3" /> Remove
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-navy-300 group-hover:text-white transition-colors">
                    Drop file here or click to browse
                  </p>
                  <p className="text-xs text-navy-500 mt-1">Accepts CSV, JSON, Parquet</p>
                </div>
              )}
              <input
                id="training-upload"
                type="file"
                className="hidden"
                accept=".csv,.json,.parquet"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) setUploadFile(file)
                }}
              />
            </div>

            {/* Target Model + Start */}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-xs text-navy-400 mb-1 block">Target Model</label>
                <div className="relative">
                  <select
                    value={uploadTarget}
                    onChange={e => setUploadTarget(e.target.value)}
                    className="input-field text-sm appearance-none pr-7"
                  >
                    <option value="">Select model...</option>
                    {models.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400 pointer-events-none" />
                </div>
              </div>
              <button
                onClick={handleStartTraining}
                disabled={!uploadTarget || !uploadFile || uploading}
                className="btn-primary text-sm flex items-center gap-2 disabled:opacity-40"
              >
                <Play className="w-4 h-4" /> Start Training
              </button>
            </div>

            {/* Progress Bar */}
            {uploading && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-navy-300">Training in progress...</span>
                  <span className="text-xs text-accent font-medium">{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-navy-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
