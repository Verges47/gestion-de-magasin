import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Loader2, AlertTriangle, PackageX, CalendarClock } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { apiFetch } from '../lib/api.js'
import { formatDate } from '../lib/utils.js'
import { cn } from '../lib/utils.js'

// Cloche de notifications : alertes de stock (rupture / seuil bas) et
// péremptions proches, alimentées par les données réelles.
export default function NotificationBell() {
  const { token, user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [alertes, setAlertes] = useState([])

  // Rôles autorisés à consulter le stock/rapports ; les autres rôles ne voient rien.
  const peutVoir = ['administrateur', 'gerant', 'magasinier', 'caissier'].includes(
    user?.role,
  )

  const bellRef = useRef(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const items = []
    try {
      const { produits } = await apiFetch('/stock.php', { token })
      produits.forEach((p) => {
        if (p.en_rupture) {
          items.push({
            type: 'rupture',
            produit: p.nom,
            stock: p.quantite_actuelle,
            seuil: p.seuil_alerte,
          })
        } else if (p.alerte) {
          items.push({
            type: 'seuil',
            produit: p.nom,
            stock: p.quantite_actuelle,
            seuil: p.seuil_alerte,
          })
        }
      })
    } catch {
      // Le stock n'est pas accessible : on reste silencieux.
    }

    // Les péremptions sont réservées admin/gérant : échec silencieux sinon.
    if (['administrateur', 'gerant'].includes(user?.role)) {
      try {
        const { peremptions } = await apiFetch(
          '/rapports.php?type=stock_valeur',
          { token },
        )
        ;(peremptions ?? []).forEach((p) => {
          items.push({
            type: 'peremption',
            produit: p.nom,
            date: p.date_peremption,
            stock: p.stock,
          })
        })
      } catch {
        // Accès refusé : on ignore silencieusement.
      }
    }

    setAlertes(items)
    setLoading(false)
  }, [token, user?.role])

  // Recharge à l'ouverture + au montage (badge visible même fermé).
  useEffect(() => {
    if (peutVoir) load()
  }, [load, peutVoir])

  // Fermeture au clic extérieur.
  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (!peutVoir) return null

  const nb = alertes.length

  return (
    <div className="relative" ref={bellRef}>
      <button
        onClick={() => {
          setOpen((v) => !v)
          if (!open) load()
        }}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
        aria-label="Notifications"
        title={
          nb > 0 ? `${nb} alerte(s)` : 'Aucune alerte'
        }
      >
        <Bell className="h-5 w-5" />
        {nb > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {nb > 99 ? '99+' : nb}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">
              Notifications
            </p>
            <span className="text-xs text-slate-400">
              {nb > 0 ? `${nb} alerte(s)` : 'Rien de neuf'}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
            </div>
          ) : nb === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="mb-2 h-7 w-7 text-slate-300" />
              <p className="text-sm text-slate-500">Aucune alerte</p>
            </div>
          ) : (
            <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {alertes.map((a, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setOpen(false)
                    if (a.type === 'peremption') {
                      navigate('/rapports')
                    } else {
                      navigate('/stock')
                    }
                  }}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
                >
                  {a.type === 'rupture' ? (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                      <PackageX className="h-4 w-4" />
                    </div>
                  ) : a.type === 'seuil' ? (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                      <CalendarClock className="h-4 w-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {a.produit}
                    </p>
                    <p className="text-xs text-slate-500">
                      {a.type === 'rupture' && 'En rupture — stock épuisé'}
                      {a.type === 'seuil' &&
                        `Stock bas : ${a.stock} restant (seuil ${a.seuil})`}
                      {a.type === 'peremption' &&
                        `Péremption le ${formatDate(a.date)} (stock ${a.stock})`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
