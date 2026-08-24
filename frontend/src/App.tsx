import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import RiskAnalysis from './pages/RiskAnalysis'
import Alerts from './pages/Alerts'
import FraudDetection from './pages/FraudDetection'
import Reports from './pages/Reports'
import Features from './pages/Features'
import Settings from './pages/Settings'
import CsvUpload from './pages/CsvUpload'
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import OTPVerification from './pages/OTPVerification'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/otp-verification" element={<OTPVerification />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/upload" element={<CsvUpload />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/risk-analysis" element={<RiskAnalysis />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/fraud-detection" element={<FraudDetection />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/features" element={<Features />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
