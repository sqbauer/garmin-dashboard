import { useState } from 'react'
import { RefreshCw, Moon, Sun, Zap } from 'lucide-react'

export function Header({ updated, name, onRefreshDone }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [token, setToken]         = useState(localStorage.getItem('gh_token') || '')
  const [status, setStatus]       = useState('')
  const [theme, setTheme]         = useState(
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  )

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.classList.toggle('dark', next === 'dark')
    setTheme(next)
  }

  async function triggerRefresh() {
    if (!token.trim()) { setStatus('Enter a GitHub PAT first.'); return }
    localStorage.setItem('gh_token', token)
    setStatus('Triggering…')
    try {
      const res = await fetch(
        'https://api.github.com/repos/sqbauer/garmin-dashboard/actions/workflows/fetch_garmin.yml/dispatches',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
          body: JSON.stringify({ ref: 'main' }),
        }
      )
      if (res.status === 204) {
        setStatus('✓ Triggered — data updates in ~5 min.')
        setTimeout(() => { setModalOpen(false); setStatus('') }, 3000)
      } else {
        const err = await res.json().catch(() => ({}))
        setStatus(`Error ${res.status}: ${err.message || 'check token'}`)
      }
    } catch {
      setStatus('Network error.')
    }
  }

  return (
    <>
      <header className="sticky top-0 z-20 bg-ink-900/90 backdrop-blur-md border-b border-ink-600/30 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-pine-800 border border-pine-700/50 flex items-center justify-center flex-shrink-0">
            <Zap size={12} className="text-pine-300" />
          </div>
          <div>
            <div className="text-sm font-semibold text-ink-50 leading-none">
              {name ? `${name}'s Cockpit` : 'Performance Cockpit'}
            </div>
            {updated && (
              <div className="text-2xs text-ink-400 mt-0.5 tabular">
                Synced {updated}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-ink-750 border border-ink-600/40 text-ink-300 hover:text-ink-100 hover:border-ink-400/60 transition-all text-xs"
            title="Trigger data refresh"
          >
            <RefreshCw size={12} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg bg-ink-750 border border-ink-600/40 text-ink-300 hover:text-ink-100 transition-all"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </header>

      {/* Refresh modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink-950/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div className="bg-ink-800 border border-ink-600/50 rounded-2xl p-5 w-full max-w-sm shadow-2xl animate-slide-up">
            <div className="text-sm font-semibold text-ink-50 mb-1">Trigger data refresh</div>
            <p className="text-xs text-ink-300 mb-4 leading-relaxed">
              Paste a GitHub PAT with <code className="bg-ink-700 px-1 rounded text-ink-100">workflow</code> scope.
              Stored only in your browser.
            </p>
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="ghp_…"
              className="w-full bg-ink-750 border border-ink-500/50 rounded-lg px-3 py-2 text-xs text-ink-100 placeholder-ink-400 outline-none focus:border-pine-600/70 mb-3"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-ink-600/50 text-xs text-ink-300 hover:text-ink-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={triggerRefresh}
                className="px-3 py-1.5 rounded-lg bg-pine-700 hover:bg-pine-600 text-pine-100 text-xs font-semibold transition-colors"
              >
                Refresh now
              </button>
            </div>
            {status && (
              <p className={`text-xs mt-2 ${status.startsWith('✓') ? 'text-pine-300' : 'text-amber-300'}`}>
                {status}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
