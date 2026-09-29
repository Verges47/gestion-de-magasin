import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Barcode,
  Printer,
  Loader2,
  Inbox,
  Package,
  AlertTriangle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { apiFetch, ApiError } from '../lib/api.js'
import { formatCurrency, cn } from '../lib/utils.js'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import Select from '../components/Select.jsx'
import Badge from '../components/Badge.jsx'
import Modal from '../components/Modal.jsx'
import CodeModal from '../components/CodeModal.jsx'

const EMPTY_FORM = {
  nom: '',
  description: '',
  id_categorie: '',
  id_fournisseur: '',
  prix_achat: '',
  prix_vente: '',
  taux_tva: '',
  unite: 'pce',
  seuil_alerte: '0',
  date_peremption: '',
  quantite_initiale: '0',
}

export default function Produits() {
  const { user, token } = useAuth()
  const canEdit = ['administrateur', 'gerant'].includes(user?.role)

  const [produits, setProduits] = useState([])
  const [categories, setCategories] = useState([])
  const [fournisseurs, setFournisseurs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [filterCategorie, setFilterCategorie] = useState('')
  const [filterFournisseur, setFilterFournisseur] = useState('')
  const [filterActif, setFilterActif] = useState('1')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [codeProduit, setCodeProduit] = useState(null)
  const [codeModalOpen, setCodeModalOpen] = useState(false)

  const loadCategories = useCallback(async () => {
    try {
      const { categories } = await apiFetch('/categories.php', { token })
      setCategories(categories)
    } catch {
      // Silencieux : les catégories sont optionnelles.
    }
  }, [token])

  const loadFournisseurs = useCallback(async () => {
    try {
      const { fournisseurs } = await apiFetch('/fournisseurs.php', { token })
      setFournisseurs(fournisseurs)
    } catch {
      // Silencieux.
    }
  }, [token])

  const loadProduits = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filterCategorie) params.set('categorie', filterCategorie)
      if (filterFournisseur) params.set('fournisseur', filterFournisseur)
      if (filterActif !== '') params.set('actif', filterActif)
      const qs = params.toString()
      const { produits } = await apiFetch(`/produits.php${qs ? '?' + qs : ''}`, {
        token,
      })
      setProduits(produits)
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Impossible de charger les produits.',
      )
    } finally {
      setLoading(false)
    }
  }, [search, filterCategorie, filterFournisseur, filterActif, token])

  useEffect(() => {
    loadCategories()
    loadFournisseurs()
  }, [loadCategories, loadFournisseurs])

  useEffect(() => {
    const t = setTimeout(loadProduits, 250)
    return () => clearTimeout(t)
  }, [loadProduits])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (p) => {
    setEditing(p)
    setForm({
      nom: p.nom ?? '',
      description: p.description ?? '',
      id_categorie: p.id_categorie ?? '',
      id_fournisseur: p.id_fournisseur ?? '',
      prix_achat: p.prix_achat ?? '',
      prix_vente: p.prix_vente ?? '',
      taux_tva: p.taux_tva ?? '',
      unite: p.unite ?? 'pce',
      seuil_alerte: p.seuil_alerte ?? '0',
      date_peremption: p.date_peremption ?? '',
      quantite_initiale: '0',
    })
    setFormError('')
    setModalOpen(true)
  }

  const set = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      const body = {
        nom: form.nom,
        description: form.description,
        id_categorie: form.id_categorie ? Number(form.id_categorie) : null,
        id_fournisseur: form.id_fournisseur ? Number(form.id_fournisseur) : null,
        prix_achat: form.prix_achat,
        prix_vente: form.prix_vente,
        taux_tva: form.taux_tva,
        unite: form.unite,
        seuil_alerte: form.seuil_alerte,
        date_peremption: form.date_peremption || null,
        quantite_initiale: form.quantite_initiale,
      }
      if (editing) {
        await apiFetch(`/produits.php/${editing.id}`, {
          method: 'PUT',
          token,
          body,
        })
      } else {
        await apiFetch('/produits.php', { method: 'POST', token, body })
      }
      setModalOpen(false)
      loadProduits()
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : 'Erreur lors de l’enregistrement.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDisable = async (p) => {
    if (!window.confirm(`Désactiver le produit « ${p.nom} » ?`)) return
    try {
      await apiFetch(`/produits.php/${p.id}`, { method: 'DELETE', token })
      loadProduits()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur.')
    }
  }

  const openCodes = (p) => {
    setCodeProduit(p)
    setCodeModalOpen(true)
  }

  const imprimerEtiquettes = (p) => {
    window.open(`/jvuim/api/etiquettes.php?produits=${p.id}`, '_blank')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Produits
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gérez votre catalogue de produits.
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouveau produit
          </Button>
        )}
      </div>

      {/* Filtres */}
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom…"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>
          <Select
            value={filterCategorie}
            onChange={(e) => setFilterCategorie(e.target.value)}
          >
            <option value="">Toutes les catégories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            value={filterFournisseur}
            onChange={(e) => setFilterFournisseur(e.target.value)}
          >
            <option value="">Tous les fournisseurs</option>
            {fournisseurs.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
          <Select
            value={filterActif}
            onChange={(e) => setFilterActif(e.target.value)}
          >
            <option value="1">Actifs uniquement</option>
            <option value="0">Désactivés uniquement</option>
            <option value="">Tous</option>
          </Select>
        </div>
      </Card>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Tableau */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          </div>
        ) : produits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="mb-3 h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">Aucun produit</p>
            <p className="mt-1 text-xs text-slate-400">
              Commencez par ajouter un produit.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium">Produit</th>
                  <th className="px-4 py-3 font-medium">Catégorie</th>
                  <th className="px-4 py-3 font-medium">Prix vente</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  {canEdit && <th className="px-4 py-3 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {produits.map((p) => {
                  const low =
                    p.seuil_alerte > 0 &&
                    Number(p.stock) <= Number(p.seuil_alerte)
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                            <Package className="h-5 w-5" />
                          </div>
                          <div>
                            <p
                              className={cn(
                                'font-medium text-slate-900',
                                Number(p.actif) === 0 && 'text-slate-400 line-through',
                              )}
                            >
                              {p.nom}
                            </p>
                            <p className="text-xs text-slate-400">
                              {p.fournisseur_nom ?? '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.categorie_nom ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {formatCurrency(p.prix_vente)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'font-medium',
                            low ? 'text-amber-600' : 'text-slate-700',
                          )}
                        >
                          {Number(p.stock) ?? 0}
                        </span>
                        {low && (
                          <Badge tone="amber" className="ml-2">
                            Seuil bas
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {Number(p.actif) === 1 ? (
                          <Badge tone="green">Actif</Badge>
                        ) : (
                          <Badge tone="slate">Désactivé</Badge>
                        )}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEdit(p)}
                              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              title="Modifier"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openCodes(p)}
                              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              title="Codes-barres / QR"
                            >
                              <Barcode className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => imprimerEtiquettes(p)}
                              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              title="Imprimer l’étiquette"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                            {Number(p.actif) === 1 && (
                              <button
                                onClick={() => handleDisable(p)}
                                className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                title="Désactiver"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modale création / édition */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier le produit' : 'Nouveau produit'}
        wide
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {formError}
            </div>
          )}

          <Input
            id="nom"
            label="Nom"
            value={form.nom}
            onChange={set('nom')}
            required
          />
          <Input
            id="description"
            label="Description"
            value={form.description}
            onChange={set('description')}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              id="categorie"
              label="Catégorie"
              value={form.id_categorie}
              onChange={set('id_categorie')}
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select
              id="fournisseur"
              label="Fournisseur"
              value={form.id_fournisseur}
              onChange={set('id_fournisseur')}
            >
              <option value="">—</option>
              {fournisseurs.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              id="prix_achat"
              label="Prix d’achat"
              type="number"
              step="0.01"
              value={form.prix_achat}
              onChange={set('prix_achat')}
            />
            <Input
              id="prix_vente"
              label="Prix de vente"
              type="number"
              step="0.01"
              value={form.prix_vente}
              onChange={set('prix_vente')}
            />
            <Input
              id="taux_tva"
              label="TVA (%)"
              type="number"
              step="0.01"
              value={form.taux_tva}
              onChange={set('taux_tva')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              id="unite"
              label="Unité"
              value={form.unite}
              onChange={set('unite')}
            />
            <Input
              id="seuil_alerte"
              label="Seuil d’alerte"
              type="number"
              value={form.seuil_alerte}
              onChange={set('seuil_alerte')}
            />
            <Input
              id="date_peremption"
              label="Date de péremption"
              type="date"
              value={form.date_peremption}
              onChange={set('date_peremption')}
            />
          </div>

          {!editing && (
            <Input
              id="quantite_initiale"
              label="Quantité initiale en stock"
              type="number"
              value={form.quantite_initiale}
              onChange={set('quantite_initiale')}
            />
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
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </form>
      </Modal>

      <CodeModal
        produit={codeProduit}
        open={codeModalOpen}
        onClose={() => setCodeModalOpen(false)}
        onChanged={loadProduits}
      />
    </div>
  )
}
