import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import RiskAnalysis from './pages/RiskAnalysis'
import Alerts from './pages/Alerts'
import AIModels from './pages/AIModels'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Cases from './pages/Cases'
import AuditLog from './pages/AuditLog'
import CsvUpload from './pages/CsvUpload'
import Login from './pages/Login'
import Register from './pages/Register'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/upload" element={<CsvUpload />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/risk-analysis" element={<RiskAnalysis />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/ai-models" element={<AIModels />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/cases" element={<Cases />} />
        <Route path="/audit" element={<AuditLog />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
