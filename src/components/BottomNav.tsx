import { ChartNoAxesCombined, ClipboardPlus, Settings } from 'lucide-react'

export type AppScreen = 'dashboard' | 'log' | 'settings'

interface BottomNavProps {
  active: AppScreen
  onChange: (screen: AppScreen) => void
}

const items = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: ChartNoAxesCombined },
  { id: 'log' as const, label: 'Log', icon: ClipboardPlus },
  { id: 'settings' as const, label: 'Settings', icon: Settings },
]

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      {items.map(({ id, label, icon: Icon }) => {
        const selected = active === id
        return (
          <button
            key={id}
            type="button"
            className="bottom-nav__item"
            aria-current={selected ? 'page' : undefined}
            onClick={() => onChange(id)}
          >
            <Icon
              size={24}
              strokeWidth={selected ? 2.4 : 1.8}
              aria-hidden="true"
            />
            <span>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
