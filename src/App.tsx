import { lazy, Suspense, useEffect, useState } from 'react'
import { AppShell } from './components/AppShell'
import type { AppScreen } from './components/BottomNav'
import { LoadingScreen } from './components/LoadingScreen'
import { initializeDatabase } from './db/seed'
import { setReservoirCropIds } from './lib/preferences'

const DashboardScreen = lazy(() => import('./screens/DashboardScreen'))
const LogScreen = lazy(() => import('./screens/LogScreen'))
const SettingsScreen = lazy(() => import('./screens/SettingsScreen'))

let initializationPromise: Promise<number[]> | null = null

function getInitialization(): Promise<number[]> {
  initializationPromise ??= initializeDatabase()
  return initializationPromise
}

function App() {
  const [screen, setScreen] = useState<AppScreen>('dashboard')
  const [reservoirCropIds, updateReservoirCropIds] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getInitialization()
      .then((ids) => {
        if (active) updateReservoirCropIds(ids)
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

  const changeReservoirCrops = (ids: number[]) => {
    setReservoirCropIds(ids)
    updateReservoirCropIds(ids)
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

  if (!reservoirCropIds.length) return <LoadingScreen />

  return (
    <AppShell screen={screen} onScreenChange={setScreen}>
      <Suspense fallback={<LoadingScreen />}>
        {screen === 'dashboard' ? (
          <DashboardScreen
            reservoirCropIds={reservoirCropIds}
            onOpenLog={() => setScreen('log')}
          />
        ) : screen === 'log' ? (
          <LogScreen reservoirCropIds={reservoirCropIds} />
        ) : (
          <SettingsScreen
            reservoirCropIds={reservoirCropIds}
            onReservoirCropsChange={changeReservoirCrops}
          />
        )}
      </Suspense>
    </AppShell>
  )
}

export default App
