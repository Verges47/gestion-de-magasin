import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Loader2, Inbox, Truck, AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { apiFetch, ApiError } from '../lib/api.js'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import Modal from '../components/Modal.jsx'

const EMPTY = { name: '', phone: '', email: '', address: '' }

export default function Fournisseurs() {
  const { user, token } = useAuth()
  const canEdit = ['administrateur', 'gerant'].includes(user?.role)

  const [fournisseurs, setFournisseurs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { fournisseurs } = await apiFetch('/fournisseurs.php', { token })
      setFournisseurs(fournisseurs)
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
    setForm(EMPTY)
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (f) => {
    setEditing(f)
    setForm({
      name: f.name ?? '',
      phone: f.phone ?? '',
      email: f.email ?? '',
      address: f.address ?? '',
    })
    setFormError('')
    setModalOpen(true)
  }

  const set = (field) => (e) => setForm((v) => ({ ...v, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      if (editing) {
        await apiFetch(`/fournisseurs.php/${editing.id}`, {
          method: 'PUT',
          token,
          body: form,
        })
      } else {
        await apiFetch('/fournisseurs.php', { method: 'POST', token, body: form })
      }
      setModalOpen(false)
      load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erreur d’enregistrement.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (f) => {
    if (!window.confirm(`Supprimer le fournisseur « ${f.name} » ?`)) return
    try {
      await apiFetch(`/fournisseurs.php/${f.id}`, { method: 'DELETE', token })
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
            Fournisseurs
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gérez les fiches de vos fournisseurs.
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouveau fournisseur
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
      ) : fournisseurs.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Aucun fournisseur</p>
          <p className="mt-1 text-xs text-slate-400">
            Ajoutez votre premier fournisseur.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {fournisseurs.map((f) => (
            <Card key={f.id} className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Truck className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{f.name}</p>
                  <p className="text-xs text-slate-400">
                    {f.nb_produits} produit(s) lié(s)
                  </p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(f)}
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      title="Modifier"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(f)}
                      className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              <dl className="mt-4 space-y-1.5 text-sm">
                {f.phone && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">Téléphone</dt>
                    <dd className="text-right text-slate-700">{f.phone}</dd>
                  </div>
                )}
                {f.email && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">Email</dt>
                    <dd className="truncate text-right text-slate-700">{f.email}</dd>
                  </div>
                )}
                {f.address && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">Adresse</dt>
                    <dd className="text-right text-slate-700">{f.address}</dd>
                  </div>
                )}
              </dl>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {formError}
            </div>
          )}
          <Input
            id="fourn-name"
            label="Nom"
            value={form.name}
            onChange={set('name')}
            required
          />
          <Input
            id="fourn-phone"
            label="Téléphone"
            value={form.phone}
            onChange={set('phone')}
          />
          <Input
            id="fourn-email"
            label="Email"
            type="email"
            value={form.email}
            onChange={set('email')}
          />
          <Input
            id="fourn-address"
            label="Adresse"
            value={form.address}
            onChange={set('address')}
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
              {editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}