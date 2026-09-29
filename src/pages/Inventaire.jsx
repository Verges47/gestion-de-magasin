import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus,
  ScanLine,
  Loader2,
  Inbox,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Search,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { apiFetch, ApiError } from '../lib/api.js'
import { formatDate, cn } from '../lib/utils.js'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import Badge from '../components/Badge.jsx'
import Modal from '../components/Modal.jsx'

export default function Inventaire() {
  const { user, token } = useAuth()
  const canWrite = ['administrateur', 'gerant', 'magasinier'].includes(user?.role)

  const [inventaires, setInventaires] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Session active
  const [active, setActive] = useState(null)
  const [scanInput, setScanInput] = useState('')
  const [lastScan, setLastScan] = useState(null)
  const [scanBusy, setScanBusy] = useState(false)
  const inputRef = useRef(null)

  const loadList = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { inventaires } = await apiFetch('/inventaire.php', { token })
      setInventaires(inventaires)
      const enCours = inventaires.find((i) => i.statut === 'en_cours')
      if (enCours) {
        loadDetail(enCours.id)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur de chargement.')
    } finally {
      setLoading(false)
    }
  }, [token])

  const loadDetail = useCallback(
    async (id) => {
      try {
        const { inventaire } = await apiFetch(`/inventaire.php/${id}`, { token })
        setActive(inventaire)
      } catch {
        // Silencieux.
      }
    },
    [token],
  )

  useEffect(() => {
    loadList()
  }, [loadList])

  const demarrer = async () => {
    try {
      const { id } = await apiFetch('/inventaire.php', { method: 'POST', token })
      await loadList()
      setActive(null)
      loadDetail(id)
      setScanInput('')
      setLastScan(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur.')
    }
  }

  const scanner = async (e) => {
    e.preventDefault()
    const code = scanInput.trim()
    if (!code || scanBusy) return
    setScanBusy(true)
    try {
      const res = await apiFetch(`/inventaire.php/${active.id}/scanner`, {
        method: 'POST',
        token,
        body: { code },
      })
      setLastScan({
        ...res,
        ok: true,
      })
      setScanInput('')
      loadDetail(active.id)
    } catch (err) {
      setLastScan({
        ok: false,
        message: err instanceof ApiError ? err.message : 'Erreur.',
      })
      setScanInput('')
    } finally {
      setScanBusy(false)
      inputRef.current?.focus()
    }
  }

  const cloturer = async () => {
    if (!window.confirm('Clôturer l’inventaire et appliquer les écarts au stock ?'))
      return
    try {
      const res = await apiFetch(`/inventaire.php/${active.id}/cloturer`, {
        method: 'POST',
        token,
      })
      setError(
        `Inventaire clôturé : ${res.ecarts?.length ?? 0} écart(s) appliqué(s).`,
      )
      setActive(null)
      setLastScan(null)
      loadList()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Inventaire
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Réalisez un inventaire par scan et calculez les écarts.
          </p>
        </div>
        {canWrite && (
          <Button onClick={demarrer}>
            <Plus className="h-4 w-4" />
            Démarrer un inventaire
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Session active */}
      {active && active.statut === 'en_cours' && (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Inventaire #{active.id} en cours
              </h2>
              <p className="text-xs text-slate-400">
                {active.nb_produits ?? 0} produit(s) scanné(s)
              </p>
            </div>
            <Button variant="danger" size="sm" onClick={cloturer}>
              <CheckCircle2 className="h-4 w-4" />
              Clôturer
            </Button>
          </div>

          <form onSubmit={scanner} className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              placeholder="Scanner un code-barres / QR…"
              autoFocus
              className="w-full rounded-lg border border-slate-300 bg-slate-50 py-3 pl-9 pr-12 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
            <button
              type="submit"
              disabled={scanBusy}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-brand-600 p-1.5 text-white hover:bg-brand-700"
              title="Scanner"
            >
              {scanBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ScanLine className="h-4 w-4" />
              )}
            </button>
          </form>

          {lastScan && (
            <div
              className={cn(
                'mt-3 flex items-center gap-2 rounded-lg p-3 text-sm',
                lastScan.ok
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-red-50 text-red-700',
              )}
            >
              {lastScan.ok ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {lastScan.produit?.nom} — compté {lastScan.quantite_comptee} /
                  attendu {lastScan.quantite_attendu}
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  {lastScan.message}
                </>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Liste des sessions */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Sessions d’inventaire
          </h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          </div>
        ) : inventaires.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="mb-3 h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">Aucun inventaire</p>
            <p className="mt-1 text-xs text-slate-400">
              Démarrez un inventaire pour commencer.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {inventaires.map((i) => (
              <button
                key={i.id}
                onClick={() => loadDetail(i.id)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">
                    Inventaire #{i.id}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDate(i.date)} · {i.utilisateur_nom ?? '—'} ·{' '}
                    {i.nb_produits ?? 0} produit(s)
                  </p>
                </div>
                {i.statut === 'en_cours' ? (
                  <Badge tone="amber">En cours</Badge>
                ) : (
                  <Badge tone="green">Clôturé</Badge>
                )}
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Détail clôturé */}
      <Modal
        open={!!active && active.statut === 'cloture'}
        onClose={() => setActive(null)}
        title={`Écarts — Inventaire #${active?.id ?? ''}`}
        wide
      >
        {active && (
          <div className="max-h-[60vh] overflow-y-auto">
            {active.lignes?.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                Aucun produit scanné.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                    <th className="py-2 font-medium">Produit</th>
                    <th className="py-2 font-medium">Attendu</th>
                    <th className="py-2 font-medium">Compté</th>
                    <th className="py-2 font-medium">Écart</th>
                  </tr>
                </thead>
                <tbody>
                  {active.lignes.map((l) => (
                    <tr key={l.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2">{l.produit_nom}</td>
                      <td className="py-2">{l.quantite_attendu}</td>
                      <td className="py-2">{l.quantite_comptee}</td>
                      <td className="py-2">
                        <span
                          className={cn(
                            'font-semibold',
                            l.ecart > 0
                              ? 'text-emerald-600'
                              : l.ecart < 0
                                ? 'text-red-600'
                                : 'text-slate-500',
                          )}
                        >
                          {l.ecart > 0 ? '+' : ''}
                          {l.ecart}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}