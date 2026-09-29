import { useState, useEffect, useCallback } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Settings2,
  Loader2,
  Inbox,
  Boxes,
  AlertTriangle,
  History,
  Search,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { apiFetch, ApiError } from '../lib/api.js'
import { formatDate, cn } from '../lib/utils.js'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import Select from '../components/Select.jsx'
import Badge from '../components/Badge.jsx'
import Modal from '../components/Modal.jsx'

const TYPE_LABELS = {
  entree: 'Entrée',
  sortie: 'Sortie',
  ajustement: 'Ajustement',
}

const TYPE_TONES = {
  entree: 'green',
  sortie: 'red',
  ajustement: 'amber',
}

export default function Stock() {
  const { user, token } = useAuth()
  const canWrite = ['administrateur', 'gerant', 'magasinier'].includes(user?.role)

  const [produits, setProduits] = useState([])
  const [mouvements, setMouvements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  // Mouvement modal
  const [modalOpen, setModalOpen] = useState(false)
  const [mvProduit, setMvProduit] = useState(null)
  const [mvType, setMvType] = useState('entree')
  const [mvQuantite, setMvQuantite] = useState('')
  const [mvMotif, setMvMotif] = useState('')
  const [saving, setSaving] = useState(false)
  const [mvError, setMvError] = useState('')

  const loadProduits = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { produits } = await apiFetch('/stock.php', { token })
      setProduits(produits)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur de chargement.')
    } finally {
      setLoading(false)
    }
  }, [token])

  const loadMouvements = useCallback(async () => {
    try {
      const { mouvements } = await apiFetch('/stock.php/mouvements', { token })
      setMouvements(mouvements)
    } catch {
      // Silencieux.
    }
  }, [token])

  useEffect(() => {
    loadProduits()
    loadMouvements()
  }, [loadProduits, loadMouvements])

  const openMovement = (produit, type) => {
    setMvProduit(produit)
    setMvType(type)
    setMvQuantite('')
    setMvMotif('')
    setMvError('')
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMvError('')
    const qty = Number(mvQuantite)
    if (!qty || qty <= 0) {
      setMvError('Entrez une quantité valide.')
      return
    }
    setSaving(true)
    try {
      await apiFetch('/stock.php', {
        method: 'POST',
        token,
        body: {
          id_produit: mvProduit.id,
          type: mvType,
          quantite: qty,
          motif: mvMotif,
          allow_negative: mvType === 'ajustement',
        },
      })
      setModalOpen(false)
      loadProduits()
      loadMouvements()
    } catch (err) {
      setMvError(err instanceof ApiError ? err.message : 'Erreur d’enregistrement.')
    } finally {
      setSaving(false)
    }
  }

  const filtered = produits.filter((p) =>
    p.nom.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Stock
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Suivez les niveaux de stock et enregistrez les mouvements.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Card className="p-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Niveaux de stock */}
        <Card className="overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              Niveaux de stock
            </h2>
            <span className="text-xs text-slate-400">
              {filtered.length} produit(s)
            </span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">Aucun produit</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <Boxes className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{p.nom}</p>
                    <p className="text-xs text-slate-400">
                      Seuil : {p.seuil_alerte} {p.unite}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        'text-lg font-semibold',
                        p.en_rupture
                          ? 'text-red-600'
                          : p.alerte
                            ? 'text-amber-600'
                            : 'text-slate-900',
                      )}
                    >
                      {p.quantite_actuelle}
                    </p>
                    <p className="text-xs text-slate-400">{p.unite}</p>
                  </div>
                  <div>
                    {p.en_rupture ? (
                      <Badge tone="red">Rupture</Badge>
                    ) : p.alerte ? (
                      <Badge tone="amber">Seuil bas</Badge>
                    ) : (
                      <Badge tone="green">OK</Badge>
                    )}
                  </div>
                  {canWrite && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openMovement(p, 'entree')}
                        className="rounded p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                        title="Entrée"
                      >
                        <ArrowDownToLine className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openMovement(p, 'sortie')}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Sortie"
                      >
                        <ArrowUpFromLine className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openMovement(p, 'ajustement')}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Ajustement"
                      >
                        <Settings2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Derniers mouvements */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              Derniers mouvements
            </h2>
            <History className="h-4 w-4 text-slate-400" />
          </div>
          {mouvements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">Aucun mouvement</p>
            </div>
          ) : (
            <div className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto">
              {mouvements.slice(0, 20).map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                  <Badge tone={TYPE_TONES[m.type]}>
                    {m.quantite > 0 ? '+' : ''}
                    {m.quantite}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {m.produit_nom}
                    </p>
                    <p className="text-xs text-slate-400">
                      {TYPE_LABELS[m.type]} · {formatDate(m.date)}
                      {m.utilisateur_nom ? ` · ${m.utilisateur_nom}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Modale mouvement */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={mvProduit ? `Mouvement — ${mvProduit.nom}` : 'Mouvement de stock'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {mvError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {mvError}
            </div>
          )}

          <Select
            id="mv-type"
            label="Type"
            value={mvType}
            onChange={(e) => setMvType(e.target.value)}
          >
            <option value="entree">Entrée (réception)</option>
            <option value="sortie">Sortie (vente, casse, retour)</option>
            <option value="ajustement">Ajustement (inventaire)</option>
          </Select>

          {mvType === 'ajustement' ? (
            <Input
              id="mv-qty"
              label="Nouvelle quantité (inventaire)"
              type="number"
              value={mvQuantite}
              onChange={(e) => setMvQuantite(e.target.value)}
              hint={`Quantité actuelle : ${mvProduit?.quantite_actuelle ?? 0}`}
              required
            />
          ) : (
            <Input
              id="mv-qty"
              label="Quantité"
              type="number"
              value={mvQuantite}
              onChange={(e) => setMvQuantite(e.target.value)}
              hint={`Disponible : ${mvProduit?.quantite_actuelle ?? 0}`}
              required
            />
          )}

          <Input
            id="mv-motif"
            label="Motif (optionnel)"
            value={mvMotif}
            onChange={(e) => setMvMotif(e.target.value)}
            placeholder={
              mvType === 'sortie'
                ? 'Ex : casse, retour fournisseur…'
                : 'Ex : réception fournisseur…'
            }
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}