import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Loader2, Inbox, Tags, AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { apiFetch, ApiError } from '../lib/api.js'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import Select from '../components/Select.jsx'
import Modal from '../components/Modal.jsx'

export default function Categories() {
  const { user, token } = useAuth()
  const canEdit = ['administrateur', 'gerant'].includes(user?.role)

  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { categories } = await apiFetch('/categories.php', { token })
      setCategories(categories)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur de chargement.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setName('')
    setParentId('')
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (c) => {
    setEditing(c)
    setName(c.name)
    setParentId(c.parent_id ?? '')
    setFormError('')
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      const body = { name, parent_id: parentId ? Number(parentId) : null }
      if (editing) {
        await apiFetch(`/categories.php/${editing.id}`, {
          method: 'PUT',
          token,
          body,
        })
      } else {
        await apiFetch('/categories.php', { method: 'POST', token, body })
      }
      setModalOpen(false)
      load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erreur d’enregistrement.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (c) => {
    if (!window.confirm(`Supprimer la catégorie « ${c.name} » ?`)) return
    try {
      await apiFetch(`/categories.php/${c.id}`, { method: 'DELETE', token })
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur.')
    }
  }

  const byParent = new Map()
  categories.forEach((c) => {
    const key = c.parent_id ?? 0
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(c)
  })

  const renderCategory = (c, depth = 0) => {
    const children = byParent.get(c.id) ?? []
    return (
      <div key={c.id}>
        <div
          className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0 hover:bg-slate-50"
          style={{ paddingLeft: `${12 + depth * 24}px` }}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Tags className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-slate-900">{c.name}</p>
            <p className="text-xs text-slate-400">
              {c.parent_nom ? `Sous-catégorie de ${c.parent_nom}` : 'Catégorie racine'}
            </p>
          </div>
          <span className="text-xs text-slate-400">{c.nb_produits} produit(s)</span>
          {canEdit && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => openEdit(c)}
                className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="Modifier"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(c)}
                className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                title="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        {children.map((child) => renderCategory(child, depth + 1))}
      </div>
    )
  }

  const roots = byParent.get(0) ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Catégories
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Organisez vos produits par catégories et sous-catégories.
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouvelle catégorie
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Card className="overflow-hidden p-2">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          </div>
        ) : roots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="mb-3 h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">Aucune catégorie</p>
            <p className="mt-1 text-xs text-slate-400">
              Ajoutez votre première catégorie.
            </p>
          </div>
        ) : (
          <div className="px-2">
            {roots.map((c) => renderCategory(c, 0))}
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {formError}
            </div>
          )}
          <Input
            id="cat-name"
            label="Nom"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Select
            id="cat-parent"
            label="Catégorie parente (optionnel)"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            <option value="">Aucune (catégorie racine)</option>
            {categories
              .filter((c) => !editing || c.id !== editing.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
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
    </div>
  )
}