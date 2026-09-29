import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  Trash2,
  Loader2,
  Inbox,
  FileText,
  AlertTriangle,
  Truck,
  PackagePlus,
  Send,
  XCircle,
  CheckCircle2,
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

const STATUT_LABELS = {
  brouillon: 'Brouillon',
  envoyee: 'Envoyée',
  recue: 'Reçue',
  annulee: 'Annulée',
}

const STATUT_TONES = {
  brouillon: 'slate',
  envoyee: 'blue',
  recue: 'green',
  annulee: 'red',
}

export default function Commandes() {
  const { user, token } = useAuth()
  const canWrite = ['administrateur', 'gerant', 'magasinier'].includes(user?.role)

  const [commandes, setCommandes] = useState([])
  const [fournisseurs, setFournisseurs] = useState([])
  const [produits, setProduits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Formulaire nouvelle commande
  const [modalOpen, setModalOpen] = useState(false)
  const [idFournisseur, setIdFournisseur] = useState('')
  const [lignes, setLignes] = useState([])
  const [ligneProduit, setLigneProduit] = useState('')
  const [ligneQty, setLigneQty] = useState('1')
  const [lignePrix, setLignePrix] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [c, f, p] = await Promise.all([
        apiFetch('/commandes.php', { token }),
        apiFetch('/fournisseurs.php', { token }),
        apiFetch('/produits.php?actif=1', { token }),
      ])
      setCommandes(c.commandes)
      setFournisseurs(f.fournisseurs)
      setProduits(p.produits)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur de chargement.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const addLigne = () => {
    const id = Number(ligneProduit)
    const qty = Number(ligneQty)
    if (!id || !qty || qty <= 0) return
    const produit = produits.find((p) => p.id === id)
    const prix = lignePrix !== '' ? Number(lignePrix) : Number(produit?.prix_achat ?? 0)
    setLignes((prev) => [...prev, { id_produit: id, nom: produit?.nom, quantite: qty, prix_achat: prix }])
    setLigneProduit('')
    setLigneQty('1')
    setLignePrix('')
  }

  const removeLigne = (idx) => {
    setLignes((prev) => prev.filter((_, i) => i !== idx))
  }

  const openCreate = () => {
    setIdFournisseur('')
    setLignes([])
    setLigneProduit('')
    setLigneQty('1')
    setLignePrix('')
    setFormError('')
    setModalOpen(true)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!idFournisseur) {
      setFormError('Choisissez un fournisseur.')
      return
    }
    if (lignes.length === 0) {
      setFormError('Ajoutez au moins une ligne.')
      return
    }
    setSaving(true)
    try {
      await apiFetch('/commandes.php', {
        method: 'POST',
        token,
        body: {
          id_fournisseur: Number(idFournisseur),
          lignes: lignes.map((l) => ({
            id_produit: l.id_produit,
            quantite: l.quantite,
            prix_achat: l.prix_achat,
          })),
        },
      })
      setModalOpen(false)
      load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erreur d’enregistrement.')
    } finally {
      setSaving(false)
    }
  }

  const setStatut = async (c, statut) => {
    try {
      await apiFetch(`/commandes.php/${c.id}`, {
        method: 'PUT',
        token,
        body: { statut },
      })
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur.')
    }
  }

  const recevoir = async (c) => {
    if (!window.confirm(`Marquer la commande #${c.id} comme reçue (mise à jour du stock) ?`))
      return
    try {
      await apiFetch(`/commandes.php/${c.id}/recevoir`, { method: 'POST', token })
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Commandes fournisseur
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Créez et suivez vos bons de commande jusqu'à la réception.
          </p>
        </div>
        {canWrite && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouvelle commande
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <Card className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </Card>
      ) : commandes.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Aucune commande</p>
          <p className="mt-1 text-xs text-slate-400">
            Créez votre premier bon de commande.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {commandes.map((c) => (
            <Card key={c.id} className="p-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">
                    Commande #{c.id} — {c.fournisseur_nom}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDate(c.date)} · {c.nb_articles ?? 0} article(s)
                  </p>
                </div>
                <Badge tone={STATUT_TONES[c.statut]}>{STATUT_LABELS[c.statut]}</Badge>

                {canWrite && (
                  <div className="flex items-center gap-1">
                    {c.statut === 'brouillon' && (
                      <>
                        <button
                          onClick={() => setStatut(c, 'envoyee')}
                          className="rounded p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                          title="Envoyer"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setStatut(c, 'annulee')}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Annuler"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {(c.statut === 'brouillon' || c.statut === 'envoyee') && (
                      <button
                        onClick={() => recevoir(c)}
                        className="rounded p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                        title="Recevoir (mise à jour du stock)"
                      >
                        <PackagePlus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modale nouvelle commande */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nouvelle commande"
        wide
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {formError}
            </div>
          )}

          <Select
            id="fournisseur"
            label="Fournisseur"
            value={idFournisseur}
            onChange={(e) => setIdFournisseur(e.target.value)}
          >
            <option value="">— Choisir —</option>
            {fournisseurs.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>

          {/* Ajout de ligne */}
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-sm font-medium text-slate-700">Ajouter un article</p>
            <div className="grid gap-3 sm:grid-cols-4">
              <Select
                id="ligne-produit"
                value={ligneProduit}
                onChange={(e) => setLigneProduit(e.target.value)}
              >
                <option value="">Produit…</option>
                {produits.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom}
                  </option>
                ))}
              </Select>
              <Input
                id="ligne-qty"
                type="number"
                placeholder="Qté"
                value={ligneQty}
                onChange={(e) => setLigneQty(e.target.value)}
              />
              <Input
                id="ligne-prix"
                type="number"
                step="0.01"
                placeholder="Prix achat"
                value={lignePrix}
                onChange={(e) => setLignePrix(e.target.value)}
              />
              <Button type="button" variant="secondary" onClick={addLigne}>
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
            </div>
          </div>

          {/* Lignes ajoutées */}
          {lignes.length > 0 && (
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {lignes.map((l, idx) => (
                <div key={idx} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <Truck className="h-4 w-4 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{l.nom}</p>
                  </div>
                  <span className="text-slate-500">× {l.quantite}</span>
                  <span className="w-24 text-right text-slate-700">
                    {formatCurrency(l.prix_achat)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLigne(idx)}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Créer la commande
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}