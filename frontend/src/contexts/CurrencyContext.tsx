import { createContext, useContext, useState, useCallback } from 'react'

type CurrencyCode = 'USD' | 'INR'

interface CurrencyContextValue {
  currency: CurrencyCode
  toggleCurrency: () => void
  formatCurrency: (value: number) => string
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: 'USD',
  toggleCurrency: () => {},
  formatCurrency: (v) => `$${v.toLocaleString()}`,
})

const STORAGE_KEY = 'ai-risk-manager-currency'

function getInitialCurrency(): CurrencyCode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'USD' || stored === 'INR') return stored
  } catch {}
  return 'USD'
}

const FORMATTERS: Record<CurrencyCode, Intl.NumberFormat> = {
  USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }),
  INR: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }),
}

const FORMATTERS_DECIMAL: Record<CurrencyCode, Intl.NumberFormat> = {
  USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
  INR: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }),
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<CurrencyCode>(getInitialCurrency)

  const toggleCurrency = useCallback(() => {
    setCurrency(prev => {
      const next = prev === 'USD' ? 'INR' : 'USD'
      try { localStorage.setItem(STORAGE_KEY, next) } catch {}
      return next
    })
  }, [])

  const formatCurrency = useCallback((value: number) => {
    return FORMATTERS[currency].format(value)
  }, [currency])

  const formatCurrencyDecimal = useCallback((value: number) => {
    return FORMATTERS_DECIMAL[currency].format(value)
  }, [currency])

  return (
    <CurrencyContext.Provider value={{ currency, toggleCurrency, formatCurrency }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  return useContext(CurrencyContext)
}
