import { Link, Outlet, useLocation } from 'react-router-dom'
import { Bug, LogOut, Moon, Plus, Sun } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { useTheme } from '../hooks/useUi.js'
import { initials } from '../lib/format.js'

export function AppShell() {
  const location = useLocation()
  const inForm = location.pathname.endsWith('/edit') || location.pathname.endsWith('/new')

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Header />
      <main
        className={
          inForm
            ? 'mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10'
            : 'mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10'
        }
      >
        <Outlet />
      </main>
    </div>
  )
}

function Header() {
  const { user, logout } = useAuth()
  const { dark, toggle } = useTheme()

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-slate-50/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
          aria-label="Bug Tracker home"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
            <Bug className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <span className="hidden text-[15px] font-semibold tracking-tight text-slate-900 sm:block dark:text-slate-100">
            Bug Tracker
          </span>
        </Link>

        <div className="flex-1" />

        <button
          onClick={toggle}
          className="btn-ghost-icon"
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={dark ? 'Light mode' : 'Dark mode'}
        >
          {dark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
        </button>

        <Link to="/bugs/new" className="btn-primary hidden sm:inline-flex">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Report bug
        </Link>

        {user && (
          <div className="ml-1 flex items-center gap-2 border-l border-slate-200 pl-2 dark:border-slate-800">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
              title={user.name}
            >
              {initials(user.name)}
            </span>
            <div className="hidden leading-tight md:block">
              <p className="max-w-28 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                {user.name}
              </p>
              <p className="max-w-28 truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
            </div>
            <button onClick={logout} className="btn-ghost-icon" title="Log out" aria-label="Log out">
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}