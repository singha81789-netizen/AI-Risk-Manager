import { useState, useRef } from 'react'
import { previewCsv, uploadCsv } from '../services/api'
import type { PreviewResponse, BatchUploadResponse, BatchResult } from '../types'

export default function CsvUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [results, setResults] = useState<BatchUploadResponse | null>(null)
  const [step, setStep] = useState<'select' | 'preview' | 'processing' | 'done'>('select')
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleDrag(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  async function handleFile(f: File) {
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a CSV file')
      return
    }
    if (f.size > 50 * 1024 * 1024) {
      setError('File size exceeds 50MB limit')
      return
    }
    setFile(f)
    setError(null)
    setPreview(null)
    setResults(null)

    try {
      const previewData = await previewCsv(f)
      setPreview(previewData)
      setStep('preview')
    } catch (err: any) {
      setError(err.message || 'Failed to preview file')
    }
  }

  async function runAnalysis() {
    if (!file) return
    try {
      setStep('processing')
      setError(null)
      const result = await uploadCsv(file)
      setResults(result)
      setStep('done')
    } catch (err: any) {
      setError(err.message || 'Failed to process file')
      setStep('preview')
    }
  }

  function reset() {
    setFile(null)
    setPreview(null)
    setResults(null)
    setStep('select')
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function downloadResults() {
    if (!results) return
    const headers = ['Transaction ID', 'Amount', 'Category', 'Risk Score', 'Risk Level', 'Decision', 'Risk Factors']
    const rows = results.results.map(r => [
      r.transaction_id || '',
      r.amount?.toFixed(2) || '',
      r.merchant_category || '',
      String(r.risk_score),
      r.risk_level,
      r.decision,
      r.triggered_risk_factors.join('; '),
    ])
    const csv = [headers, ...rows].map(row => row.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `batch_results_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="upload-page">
      <div className="upload-header">
        <h1>CSV Upload & Analysis</h1>
      </div>

      {step === 'select' && (
        <div
          className={`upload-dropzone ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleChange}
            style={{ display: 'none' }}
          />
          <div className="upload-icon">
            <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="#6366f1" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <h3>Drop your CSV file here</h3>
          <p>or click to browse</p>
          <span className="upload-hint">Supports CSV files up to 50MB</span>
        </div>
      )}

      {error && (
        <div className="upload-error">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ef4444" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {error}
        </div>
      )}

      {step === 'preview' && preview && (
        <div className="preview-section">
          <div className="preview-header">
            <div>
              <h3>File Preview: {preview.filename}</h3>
              <p>{preview.total_rows.toLocaleString()} rows detected across {preview.columns.length} columns</p>
            </div>
            <div className="preview-actions">
              <button className="btn-secondary" onClick={reset}>Cancel</button>
              <button className="btn-primary" onClick={runAnalysis}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Run Analysis
              </button>
            </div>
          </div>

          <div className="preview-columns">
            <h4>Detected Columns</h4>
            <div className="column-tags">
              {preview.columns.map(col => (
                <span key={col} className="column-tag">
                  {col}
                  <span className="column-type">{preview.detected_schema[col]}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="preview-table-wrapper">
            <h4>Preview (First {Math.min(20, preview.total_rows)} Rows)</h4>
            <div className="preview-table-scroll">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {preview.columns.slice(0, 12).map(col => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.preview_rows.map((row, i) => (
                    <tr key={i}>
                      <td className="row-num">{i + 1}</td>
                      {preview.columns.slice(0, 12).map(col => (
                        <td key={col}>{String(row[col] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {step === 'processing' && (
        <div className="processing-state">
          <div className="spinner large" />
          <h3>Processing Transactions...</h3>
          <p>Running ML pipeline on {preview?.total_rows.toLocaleString()} transactions</p>
          <p className="processing-hint">This may take a moment for large files</p>
        </div>
      )}

      {step === 'done' && results && (
        <div className="results-section">
          <div className="results-header">
            <h3>Analysis Complete</h3>
            <button className="btn-secondary" onClick={reset}>Upload Another File</button>
          </div>

          <div className="results-summary">
            <div className="result-stat">
              <span className="result-stat-value">{results.total_rows.toLocaleString()}</span>
              <span className="result-stat-label">Total Rows</span>
            </div>
            <div className="result-stat">
              <span className="result-stat-value">{results.processed_rows.toLocaleString()}</span>
              <span className="result-stat-label">Processed</span>
            </div>
            <div className="result-stat high">
              <span className="result-stat-value">{results.high_risk_count}</span>
              <span className="result-stat-label">High Risk</span>
            </div>
            <div className="result-stat medium">
              <span className="result-stat-value">{results.medium_risk_count}</span>
              <span className="result-stat-label">Medium Risk</span>
            </div>
            <div className="result-stat low">
              <span className="result-stat-value">{results.low_risk_count}</span>
              <span className="result-stat-label">Low Risk</span>
            </div>
            <div className="result-stat alert">
              <span className="result-stat-value">{results.alerts_created}</span>
              <span className="result-stat-label">Alerts Created</span>
            </div>
          </div>

          {results.errors.length > 0 && (
            <div className="results-errors">
              <h4>Errors ({results.errors.length})</h4>
              <ul>
                {results.errors.slice(0, 10).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="results-table-wrapper">
            <div className="results-table-header">
              <h4>Results ({results.results.length} transactions)</h4>
              <button className="btn-primary" onClick={downloadResults}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download CSV
              </button>
            </div>
            <div className="results-table-scroll">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Transaction ID</th>
                    <th>Amount</th>
                    <th>Category</th>
                    <th>Risk Score</th>
                    <th>Risk Level</th>
                    <th>Decision</th>
                    <th>Anomaly</th>
                    <th>Risk Factors</th>
                  </tr>
                </thead>
                <tbody>
                  {results.results.map((r, i) => (
                    <tr key={i}>
                      <td className="txn-id">{r.transaction_id}</td>
                      <td className="txn-amount">${(r.amount || 0).toLocaleString()}</td>
                      <td>{r.merchant_category}</td>
                      <td>
                        <span className={`risk-score ${r.risk_level.toLowerCase()}`}>
                          {r.risk_score}
                        </span>
                      </td>
                      <td>
                        <span className={`risk-level-badge ${r.risk_level.toLowerCase()}`}>
                          {r.risk_level}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge-light ${r.decision.toLowerCase()}`}>
                          {r.decision}
                        </span>
                      </td>
                      <td>
                        {r.is_anomaly ? (
                          <span className="anomaly-badge">Anomaly ({(r.anomaly_score * 100).toFixed(0)}%)</span>
                        ) : (
                          <span className="normal-badge">Normal</span>
                        )}
                      </td>
                      <td className="risk-factors-cell">
                        {r.triggered_risk_factors.slice(0, 2).map((f, j) => (
                          <span key={j} className="risk-tag-small">{f}</span>
                        ))}
                        {r.triggered_risk_factors.length > 2 && (
                          <span className="risk-tag-more">+{r.triggered_risk_factors.length - 2} more</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
