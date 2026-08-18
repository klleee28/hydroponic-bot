import { lazy, Suspense, useEffect, useState } from 'react'
import { AppShell } from './components/AppShell'
import type { AppScreen } from './components/BottomNav'
import { LoadingScreen } from './components/LoadingScreen'
import { initializeDatabase } from './db/seed'
import { setActiveCropId } from './lib/preferences'

const DashboardScreen = lazy(() => import('./screens/DashboardScreen'))
const LogScreen = lazy(() => import('./screens/LogScreen'))
const SettingsScreen = lazy(() => import('./screens/SettingsScreen'))

let initializationPromise: Promise<number> | null = null

function getInitialization(): Promise<number> {
  initializationPromise ??= initializeDatabase()
  return initializationPromise
}

function App() {
  const [screen, setScreen] = useState<AppScreen>('dashboard')
  const [activeCropId, updateActiveCropId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getInitialization()
      .then((id) => {
        if (active) updateActiveCropId(id)
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : 'Unable to open local storage')
        }
      })

    return () => {
      active = false
    }
  }, [])

  const changeActiveCrop = (id: number) => {
    setActiveCropId(id)
    updateActiveCropId(id)
  }

  if (error) {
    return (
      <div className="fatal-error" role="alert">
        <h1>Local storage could not open</h1>
        <p>{error}</p>
        <p>No data was sent anywhere.</p>
      </div>
    )
  }

  if (!activeCropId) return <LoadingScreen />

  return (
    <AppShell screen={screen} onScreenChange={setScreen}>
      <Suspense fallback={<LoadingScreen />}>
        {screen === 'dashboard' ? (
          <DashboardScreen
            activeCropId={activeCropId}
            onOpenLog={() => setScreen('log')}
          />
        ) : screen === 'log' ? (
          <LogScreen activeCropId={activeCropId} />
        ) : (
          <SettingsScreen
            activeCropId={activeCropId}
            onActiveCropChange={changeActiveCrop}
          />
        )}
      </Suspense>
    </AppShell>
  )
}

export default App
