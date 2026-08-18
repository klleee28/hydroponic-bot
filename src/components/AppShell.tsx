import type { ReactNode } from 'react'
import { BottomNav, type AppScreen } from './BottomNav'

interface AppShellProps {
  screen: AppScreen
  onScreenChange: (screen: AppScreen) => void
  children: ReactNode
}

export function AppShell({ screen, onScreenChange, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <main className="app-main">{children}</main>
      <BottomNav active={screen} onChange={onScreenChange} />
    </div>
  )
}
