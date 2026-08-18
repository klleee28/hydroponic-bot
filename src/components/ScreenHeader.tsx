import type { ReactNode } from 'react'

interface ScreenHeaderProps {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
}

export function ScreenHeader({ title, subtitle, action }: ScreenHeaderProps) {
  return (
    <header className="screen-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <div className="screen-subtitle">{subtitle}</div> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </header>
  )
}
