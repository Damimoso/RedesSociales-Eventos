import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from 'react'
import { getTheme, type ThemeId, type ThemeVars } from '@/lib/themes'

type ThemeContextValue = {
  themeId: ThemeId
  themeName: string
  vars: ThemeVars
  setThemeId: (id: ThemeId) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyThemeVars(vars: ThemeVars) {
  const root = document.documentElement
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(`--th-${key}`, value)
  })
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>('default')

  useEffect(() => {
    applyThemeVars(getTheme(themeId).vars)
  }, [themeId])

  const value = useMemo(() => ({
    themeId,
    themeName: getTheme(themeId).name,
    vars: getTheme(themeId).vars,
    setThemeId,
  }), [themeId])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
