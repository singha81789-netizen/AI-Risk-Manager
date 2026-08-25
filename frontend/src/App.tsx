import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import RiskAnalysis from './pages/RiskAnalysis'
import Alerts from './pages/Alerts'
import AIModels from './pages/AIModels'
import Reports from './pages/Reports'
import Features from './pages/Features'
import Settings from './pages/Settings'
import CsvUpload from './pages/CsvUpload'
import Glossary from './pages/Glossary'
import Login from './pages/Login'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/upload" element={<CsvUpload />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/risk-analysis" element={<RiskAnalysis />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/ai-models" element={<AIModels />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/features" element={<Features />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/glossary" element={<Glossary />} />
      </Route>
    </Routes>
  )
}
