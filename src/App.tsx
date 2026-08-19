import { lazy, Suspense, useEffect, useState } from 'react'
import { AppShell } from './components/AppShell'
import type { AppScreen } from './components/BottomNav'
import { LoadingScreen } from './components/LoadingScreen'
import { initializeDatabase } from './db/seed'
import {
  getLastBackupAt,
  setLastBackupAt,
  setReservoirCropIds,
} from './lib/preferences'

const DashboardScreen = lazy(() => import('./screens/DashboardScreen'))
const SeedlingsScreen = lazy(() => import('./screens/SeedlingsScreen'))
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
  const [lastBackupAt, updateLastBackupAt] = useState<number | null>(() =>
    getLastBackupAt(),
  )
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

  const completeBackup = (timestamp: number) => {
    setLastBackupAt(timestamp)
    updateLastBackupAt(timestamp)
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
            lastBackupAt={lastBackupAt}
            onBackupCompleted={completeBackup}
            onOpenLog={() => setScreen('log')}
            onOpenSeedlings={() => setScreen('seedlings')}
          />
        ) : screen === 'seedlings' ? (
          <SeedlingsScreen />
        ) : screen === 'log' ? (
          <LogScreen
            reservoirCropIds={reservoirCropIds}
            lastBackupAt={lastBackupAt}
            onBackupCompleted={completeBackup}
          />
        ) : (
          <SettingsScreen
            reservoirCropIds={reservoirCropIds}
            lastBackupAt={lastBackupAt}
            onBackupCompleted={completeBackup}
            onReservoirCropsChange={changeReservoirCrops}
          />
        )}
      </Suspense>
    </AppShell>
  )
}

export default App
