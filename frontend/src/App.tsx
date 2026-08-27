import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Alerts from './pages/Alerts'
import AIModels from './pages/AIModels'
import Reports from './pages/Reports'
import AuditLog from './pages/AuditLog'
import Settings from './pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Signup />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/ai-models" element={<AIModels />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/audit" element={<AuditLog />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
