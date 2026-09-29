import { useState, useEffect, useCallback } from 'react'
import {
  ScanLine,
  Search,
  Plus,
  Minus,
  Trash2,
  Loader2,
  Inbox,
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  RotateCcw,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { apiFetch, ApiError } from '../lib/api.js'
import { formatCurrency, formatDate, cn } from '../lib/utils.js'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import Select from '../components/Select.jsx'
import Badge from '../components/Badge.jsx'
import Modal from '../components/Modal.jsx'

export default function Ventes() {
  const { user, token } = useAuth()
  const canCreate = ['administrateur', 'gerant', 'caissier'].includes(user?.role)
  const canAnnuler = ['administrateur', 'gerant'].includes(user?.role)

  // Caisse
  const [search, setSearch] = useState('')
  const [produits, setProduits] = useState([])
  const [panier, setPanier] = useState([])
  const [modePaiement, setModePaiement] = useState('especes')
  const [scanBusy, setScanBusy] = useState(false)
  const [validating, setValidating] = useState(false)
  const [ticket, setTicket] = useState(null)
  const [error, setError] = useState('')

  // Historique
  const [ventes, setVentes] = useState([])
  const [histOpen, setHistOpen] = useState(false)

  const loadVentes = useCallback(async () => {
    try {
      const { ventes } = await apiFetch('/ventes.php?limit=50', { token })
      setVentes(ventes)
    } catch {
      // Silencieux.
    }
  }, [token])

  useEffect(() => {
    loadVentes()
  }, [loadVentes])

  const searchProduits = useCallback(
    async (q) => {
      try {
        const { produits } = await apiFetch(
          `/produits.php?search=${encodeURIComponent(q)}&actif=1`,
          { token },
        )
        setProduits(produits)
      } catch {
        setProduits([])
      }
    },
    [token],
  )

  useEffect(() => {
    if (search.trim().length >= 2) {
      const t = setTimeout(() => searchProduits(search.trim()), 250)
      return () => clearTimeout(t)
    }
    setProduits([])
    return undefined
  }, [search, searchProduits])

  // Scan rapide : cherche d'abord par code, sinon par nom.
  const handleScan = async () => {
    const code = search.trim()
    if (!code || scanBusy) return
    setScanBusy(true)
    try {
      try {
        const { produit } = await apiFetch(
          `/codes.php/scan?code=${encodeURIComponent(code)}`,
          { token },
        )
        addToPanier(produit)
        setSearch('')
      } catch {
        // Fallback : recherche par nom, prend le premier résultat.
        const { produits } = await apiFetch(
          `/produits.php?search=${encodeURIComponent(code)}&actif=1`,
          { token },
        )
        if (produits.length === 1) {
          addToPanier(produits[0])
          setSearch('')
        } else if (produits.length > 1) {
          setProduits(produits)
        } else {
          setError('Aucun produit trouvé pour ce code ou nom.')
        }
      }
    } finally {
      setScanBusy(false)
    }
  }

  const addToPanier = (p) => {
    setPanier((prev) => {
      const existing = prev.find((l) => l.id_produit === p.id)
      if (existing) {
        return prev.map((l) =>
          l.id_produit === p.id
            ? { ...l, quantite: l.quantite + 1 }
            : l,
        )
      }
      return [
        ...prev,
        {
          id_produit: p.id,
          nom: p.nom,
          prix_vente: Number(p.prix_vente),
          taux_tva: Number(p.taux_tva),
          quantite: 1,
          remise: 0,
        },
      ]
    })
  }

  const changeQty = (id, delta) => {
    setPanier((prev) =>
      prev
        .map((l) =>
          l.id_produit === id ? { ...l, quantite: l.quantite + delta } : l,
        )
        .filter((l) => l.quantite > 0),
    )
  }

  const removeLine = (id) => {
    setPanier((prev) => prev.filter((l) => l.id_produit !== id))
  }

  const totals = panier.reduce(
    (acc, l) => {
      const ht = l.prix_vente * l.quantite - l.remise
      const tva = ht * l.taux_tva / 100
      const ttc = ht + tva
      return {
        ht: acc.ht + ht,
        tva: acc.tva + tva,
        ttc: acc.ttc + ttc,
      }
    },
    { ht: 0, tva: 0, ttc: 0 },
  )

  const validate = async () => {
    if (panier.length === 0) return
    setValidating(true)
    setError('')
    try {
      const res = await apiFetch('/ventes.php', {
        method: 'POST',
        token,
        body: {
          mode_paiement: modePaiement,
          lignes: panier.map((l) => ({
            id_produit: l.id_produit,
            quantite: l.quantite,
            remise: l.remise,
          })),
        },
      })
      setTicket(res)
      setPanier([])
      setSearch('')
      loadVentes()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la vente.')
    } finally {
      setValidating(false)
    }
  }

  const annuler = async (v) => {
    if (!window.confirm(`Annuler la vente #${v.id} (${formatCurrency(v.total_ttc)}) ?`))
      return
    try {
      await apiFetch(`/ventes.php/${v.id}/annuler`, {
        method: 'POST',
        token,
        body: { statut: 'annulee' },
      })
      loadVentes()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de l’annulation.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Ventes / Caisse
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Enregistrez vos ventes en scannant les produits.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setHistOpen(true)}>
          <Receipt className="h-4 w-4" />
          Historique
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Panier */}
        <Card className="lg:col-span-3">
          <div className="border-b border-slate-200 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleScan()
                }}
                placeholder="Scanner ou rechercher un produit…"
                autoFocus
                className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-12 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
              <button
                onClick={handleScan}
                disabled={scanBusy}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-brand-600 p-1.5 text-white hover:bg-brand-700"
                title="Scanner"
              >
                <ScanLine className="h-4 w-4" />
              </button>
            </div>

            {/* Suggestions */}
            {produits.length > 0 && search.trim().length >= 2 && (
              <div className="mt-2 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                {produits.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      addToPanier(p)
                      setSearch('')
                      setProduits([])
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {p.nom}
                      </p>
                      <p className="text-xs text-slate-400">
                        Stock : {p.stock ?? 0} · {formatCurrency(p.prix_vente)}
                      </p>
                    </div>
                    <Plus className="h-4 w-4 text-slate-400" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Lignes du panier */}
          <div className="min-h-[240px]">
            {panier.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ShoppingCart className="mb-3 h-8 w-8 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">Panier vide</p>
                <p className="mt-1 text-xs text-slate-400">
                  Scannez un produit pour commencer.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {panier.map((l) => (
                  <div key={l.id_produit} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {l.nom}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatCurrency(l.prix_vente)} × {l.quantite}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => changeQty(l.id_produit, -1)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold">
                        {l.quantite}
                      </span>
                      <button
                        onClick={() => changeQty(l.id_produit, 1)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="w-24 text-right text-sm font-semibold text-slate-900">
                      {formatCurrency(l.prix_vente * l.quantite - l.remise)}
                    </span>
                    <button
                      onClick={() => removeLine(l.id_produit)}
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Totaux et validation */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Total</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Total HT</dt>
              <dd className="font-medium text-slate-900">{formatCurrency(totals.ht)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">TVA</dt>
              <dd className="font-medium text-slate-900">{formatCurrency(totals.tva)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base">
              <dt className="font-semibold text-slate-900">Total TTC</dt>
              <dd className="font-semibold text-brand-700">
                {formatCurrency(totals.ttc)}
              </dd>
            </div>
          </dl>

          <div className="mt-4">
            <Select
              id="paiement"
              label="Mode de paiement"
              value={modePaiement}
              onChange={(e) => setModePaiement(e.target.value)}
            >
              <option value="especes">Espèces</option>
              <option value="carte">Carte</option>
              <option value="mobile">Mobile money</option>
              <option value="autre">Autre</option>
            </Select>
          </div>

          <Button
            className="mt-4 w-full"
            size="lg"
            disabled={panier.length === 0 || validating}
            onClick={validate}
          >
            {validating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Validation…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Valider la vente
              </>
            )}
          </Button>
        </Card>
      </div>

      {/* Ticket de vente */}
      <Modal open={!!ticket} onClose={() => setTicket(null)} title="Vente enregistrée">
        {ticket && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              Vente #{ticket.id} validée avec succès.
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Total HT</dt>
                <dd className="font-medium">{formatCurrency(ticket.total_ht)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">TVA</dt>
                <dd className="font-medium">{formatCurrency(ticket.total_tva)}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
                <dt>Total TTC</dt>
                <dd className="text-brand-700">{formatCurrency(ticket.total_ttc)}</dd>
              </div>
            </dl>
            <Button className="w-full" onClick={() => setTicket(null)}>
              Fermer
            </Button>
          </div>
        )}
      </Modal>

      {/* Historique */}
      <Modal
        open={histOpen}
        onClose={() => setHistOpen(false)}
        title="Historique des ventes"
        wide
      >
        <div className="max-h-[60vh] overflow-y-auto">
          {ventes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Inbox className="mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">Aucune vente</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {ventes.map((v) => (
                <div key={v.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">
                      Vente #{v.id}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDate(v.date)} · {v.utilisateur_nom ?? '—'} ·{' '}
                      {v.mode_paiement ?? '—'}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatCurrency(v.total_ttc)}
                  </span>
                  {v.statut === 'validee' ? (
                    <Badge tone="green">Validée</Badge>
                  ) : v.statut === 'remboursee' ? (
                    <Badge tone="amber">Remboursée</Badge>
                  ) : (
                    <Badge tone="red">Annulée</Badge>
                  )}
                  {v.statut === 'validee' && canAnnuler && (
                    <button
                      onClick={() => annuler(v)}
                      className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Annuler la vente"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}