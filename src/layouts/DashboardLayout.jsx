import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ScanLine,
  Search,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Settings,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { apiFetch } from '../lib/api.js'
import { NAV_ITEMS } from '../data/nav.js'
import { roleLabel, roleMenu } from '../data/roles.js'
import Logo from '../components/Logo.jsx'
import NotificationBell from '../components/NotificationBell.jsx'
import ScanModal from '../components/ScanModal.jsx'
import { cn } from '../lib/utils.js'

export default function DashboardLayout() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [scanBusy, setScanBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)

  const allowed = new Set(roleMenu(user?.role))
  const items = NAV_ITEMS.filter((item) => allowed.has(item.key))

  const handleLogout = () => {
    logout()
    navigate('/connexion', { replace: true })
  }

  // Scan d'un code : affiche instantanément la fiche produit (F8).
  const handleScan = async () => {
    const code = search.trim()
    if (!code || scanBusy) return
    setScanBusy(true)
    try {
      const { produit } = await apiFetch(
        `/codes.php/scan?code=${encodeURIComponent(code)}`,
        { token },
      )
      navigate('/produits', { state: { highlight: produit.id } })
      setSearch('')
    } catch {
      setSearch('')
      // Le scan n'ayant pas trouvé de produit, on navigue vers la recherche.
      navigate('/produits')
    } finally {
      setScanBusy(false)
    }
  }

  const sidebarContent = (
    <>
      <div className="flex h-16 items-center gap-3 px-5">
        <Logo />
        <span
          className={cn(
            'text-lg font-semibold text-slate-900 transition-opacity',
            collapsed && 'lg:hidden',
          )}
        >
          StockScan
        </span>
      </div>

      <nav className="mt-2 flex-1 space-y-1 overflow-y-auto px-3">
        {items.map(({ key, label, to, icon: Icon }) => (
          <NavLink
            key={key}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100',
                collapsed && 'lg:justify-center lg:px-2',
              )
            }
            title={label}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className={cn('truncate', collapsed && 'lg:hidden')}>
              {label}
            </span>
          </NavLink>
        ))}
      </nav>
    </>
  )

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar bureau */}
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-200 lg:flex',
          collapsed ? 'w-[76px]' : 'w-64',
        )}
      >
        {sidebarContent}
        <div className="border-t border-slate-200 p-3">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
          >
            {collapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
            <span className={cn(collapsed && 'lg:hidden')}>Replier</span>
          </button>
        </div>
      </aside>

      {/* Sidebar mobile (overlay) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-lg font-semibold text-slate-900">
                StockScan
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barre du haut */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleScan()
              }}
              placeholder="Rechercher un produit…"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2 pl-9 pr-12 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
            <button
              onClick={() => setScanOpen(true)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-brand-600 p-1.5 text-white hover:bg-brand-700"
              title="Scanner un code"
            >
              <ScanLine className="h-4 w-4" />
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />

            {/* Menu utilisateur */}
            <div className="relative hidden sm:block">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2.5 rounded-lg border-l border-slate-200 py-1 pl-3 pr-2 hover:bg-slate-100"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                  {user?.name
                    ?.split(' ')
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join('')}
                </div>
                <div className="leading-tight text-left">
                  <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                  <p className="text-xs text-slate-500">{roleLabel(user?.role)}</p>
                </div>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-slate-400 transition-transform',
                    menuOpen && 'rotate-180',
                  )}
                />
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                      <p className="text-xs text-slate-400">{user?.login}</p>
                    </div>
                    <button
                      onClick={() => {
                        setMenuOpen(false)
                        navigate('/parametres')
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Settings className="h-4 w-4" />
                      Modifier mes informations
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false)
                        handleLogout()
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Se déconnecter
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Déconnexion (mobile uniquement) */}
            <button
              onClick={handleLogout}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 sm:hidden"
              aria-label="Se déconnecter"
              title="Se déconnecter"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      <ScanModal open={scanOpen} onClose={() => setScanOpen(false)} />
    </div>
  )
}
