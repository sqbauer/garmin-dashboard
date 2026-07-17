import { useState } from 'react'
import { useGarminData } from './hooks/useGarminData'
import { Header } from './components/Header'
import { ZoneA } from './components/ZoneA'
import { ZoneB } from './components/ZoneB'
import { ZoneC } from './components/ZoneC'
import { CoachPanel } from './components/CoachPanel'
import { Activity, Heart, Crosshair, MessageSquare } from 'lucide-react'

const TABS = [
  { id: 'pulse',   label: 'Daily Pulse',  Icon: Heart,         desc: 'HRV, Sleep, Body Battery' },
  { id: 'engine',  label: 'Engine',       Icon: Activity,      desc: 'Fitness–Fatigue, VO₂ max'  },
  { id: 'session', label: 'Sessions',     Icon: Crosshair,     desc: 'Laps, Maps, Pace vs HR'    },
  { id: 'coach',   label: 'Coach',        Icon: MessageSquare, desc: 'Socratic Analysis', mobileOnly: true },
]

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-900">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-pine-700 border-t-pine-400 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-xs text-ink-400">Loading Garmin data…</p>
      </div>
    </div>
  )
}

function ErrorScreen({ message }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-900 p-6">
      <div className="text-center max-w-sm">
        <p className="text-amber-300 text-sm font-semibold mb-2">Could not load data</p>
        <p className="text-ink-400 text-xs">{message}</p>
        <p className="text-ink-500 text-xs mt-3">Make sure the GitHub Actions workflow has run and committed data/garmin.json.</p>
      </div>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('pulse')
  const [coachOpen, setCoachOpen] = useState(false)
  const { data, loading, error, raw } = useGarminData()

  if (loading) return <LoadingScreen />
  if (error)   return <ErrorScreen message={error} />

  const { banister, coachQs } = data || {}

  return (
    <div className="min-h-screen bg-ink-900 text-ink-100">
      <Header updated={raw?.updated} name={raw?.name} />

      {/* Tab navigation */}
      <nav className="sticky top-[53px] z-10 bg-ink-900/95 backdrop-blur-md border-b border-ink-600/30">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="flex gap-0 overflow-x-auto no-scrollbar">
            {TABS.filter(t => !t.mobileOnly || true).map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => { setActiveTab(id); if (id === 'coach') setCoachOpen(true) }}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all
                  ${activeTab === id && id !== 'coach'
                    ? 'border-pine-500 text-pine-300'
                    : 'border-transparent text-ink-400 hover:text-ink-200'}
                  ${id === 'coach' ? 'lg:hidden' : ''}`}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main layout */}
      <div className="max-w-screen-xl mx-auto px-4 py-5">
        <div className="flex gap-5">
          {/* Primary content */}
          <main className="flex-1 min-w-0">
            {activeTab === 'pulse'   && <ZoneA raw={raw} />}
            {activeTab === 'engine'  && <ZoneB raw={raw} banister={banister} />}
            {activeTab === 'session' && <ZoneC raw={raw} />}
            {activeTab === 'coach'   && (
              <div className="lg:hidden">
                <CoachPanel coachQs={coachQs} raw={raw} />
              </div>
            )}
          </main>

          {/* Sidebar — Coach Panel (desktop only) */}
          <aside className="hidden lg:flex flex-col w-80 xl:w-96 flex-shrink-0">
            <div className="sticky top-[105px] h-[calc(100vh-115px)]">
              <CoachPanel coachQs={coachQs} raw={raw} />
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile Coach FAB */}
      <button
        onClick={() => { setActiveTab('coach') }}
        className="lg:hidden fixed bottom-5 right-5 z-30 w-12 h-12 bg-pine-800 hover:bg-pine-700 border border-pine-600/50 rounded-full shadow-xl flex items-center justify-center transition-colors"
        title="Open Performance Coach"
      >
        <MessageSquare size={18} className="text-pine-200" />
      </button>
    </div>
  )
}
