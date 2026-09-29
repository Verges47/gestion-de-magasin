import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Inbox,
  Users,
  AlertTriangle,
  ShieldCheck,
  History,
  User,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { apiFetch, ApiError } from '../lib/api.js'
import { formatDate, cn } from '../lib/utils.js'
import { roleLabel } from '../data/roles.js'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import Select from '../components/Select.jsx'
import Badge from '../components/Badge.jsx'
import Modal from '../components/Modal.jsx'

const ROLE_TONES = {
  administrateur: 'red',
  gerant: 'blue',
  magasinier: 'amber',
  caissier: 'slate',
}

const EMPTY = { login: '', name: '', role: 'caissier', password: '' }

export default function Utilisateurs() {
  const { user, token } = useAuth()
  const isAdmin = user?.role === 'administrateur'

  const [utilisateurs, setUtilisateurs] = useState([])
  const [journal, setJournal] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('utilisateurs')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { utilisateurs } = await apiFetch('/utilisateurs.php', { token })
      setUtilisateurs(utilisateurs)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur de chargement.')
    } finally {
      setLoading(false)
    }
  }, [token])

  const loadJournal = useCallback(async () => {
    try {
      const { journal } = await apiFetch('/utilisateurs.php/journal?limit=100', {
        token,
      })
      setJournal(journal)
    } catch {
      // Silencieux.
    }
  }, [token])

  useEffect(() => {
    load()
    loadJournal()
  }, [load, loadJournal])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (u) => {
    setEditing(u)
    setForm({ login: u.login, name: u.name, role: u.role, password: '' })
    setFormError('')
    setModalOpen(true)
  }

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      if (editing) {
        await apiFetch(`/utilisateurs.php/${editing.id}`, {
          method: 'PUT',
          token,
          body: { name: form.name, role: form.role, active: editing.active },
        })
      } else {
        await apiFetch('/utilisateurs.php', {
          method: 'POST',
          token,
          body: {
            login: form.login,
            name: form.name,
            role: form.role,
            password: form.password,
          },
        })
      }
      setModalOpen(false)
      load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erreur d’enregistrement.')
    } finally {
      setSaving(false)
    }
  }

  const handleDisable = async (u) => {
    if (!window.confirm(`Désactiver le compte de « ${u.name} » ?`)) return
    try {
      await apiFetch(`/utilisateurs.php/${u.id}`, { method: 'DELETE', token })
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
            Utilisateurs
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gérez les comptes, les rôles et consultez le journal des actions.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouvel utilisateur
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Onglets */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('utilisateurs')}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
            tab === 'utilisateurs'
              ? 'bg-brand-600 text-white'
              : 'bg-white text-slate-600 ring-1 ring-slate-200',
          )}
        >
          <Users className="h-4 w-4" />
          Comptes
        </button>
        {(user?.role === 'administrateur' || user?.role === 'gerant') && (
          <button
            onClick={() => {
              setTab('journal')
              loadJournal()
            }}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
              tab === 'journal'
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200',
            )}
          >
            <History className="h-4 w-4" />
            Journal
          </button>
        )}
      </div>

      {tab === 'utilisateurs' ? (
        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
            </div>
          ) : utilisateurs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">Aucun utilisateur</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-medium">Utilisateur</th>
                    <th className="px-4 py-3 font-medium">Identifiant</th>
                    <th className="px-4 py-3 font-medium">Rôle</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                    {isAdmin && <th className="px-4 py-3 font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {utilisateurs.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                            {u.name
                              .split(' ')
                              .map((p) => p[0])
                              .slice(0, 2)
                              .join('')}
                          </div>
                          <span className="font-medium text-slate-900">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{u.login}</td>
                      <td className="px-4 py-3">
                        <Badge tone={ROLE_TONES[u.role]}>{roleLabel(u.role)}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {Number(u.active) === 1 ? (
                          <Badge tone="green">Actif</Badge>
                        ) : (
                          <Badge tone="slate">Désactivé</Badge>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEdit(u)}
                              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              title="Modifier"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            {Number(u.active) === 1 && u.id !== user?.id && (
                              <button
                                onClick={() => handleDisable(u)}
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {journal.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">Aucune action journalisée</p>
            </div>
          ) : (
            <div className="max-h-[600px] divide-y divide-slate-100 overflow-y-auto">
              {journal.map((j) => (
                <div key={j.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">
                      {j.utilisateur_nom ?? 'Système'}
                    </p>
                    <p className="text-xs text-slate-500">{j.action}</p>
                    {j.details && (
                      <p className="mt-0.5 text-xs text-slate-400">{j.details}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatDate(j.date)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Modale création / édition */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier l’utilisateur' : 'Nouvel utilisateur'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {formError}
            </div>
          )}

          <Input
            id="u-name"
            label="Nom complet"
            value={form.name}
            onChange={set('name')}
            required
          />

          {!editing && (
            <Input
              id="u-login"
              label="Identifiant"
              value={form.login}
              onChange={set('login')}
              required
            />
          )}

          <Select
            id="u-role"
            label="Rôle"
            value={form.role}
            onChange={set('role')}
          >
            <option value="administrateur">Administrateur</option>
            <option value="gerant">Gérant</option>
            <option value="magasinier">Magasinier</option>
            <option value="caissier">Caissier</option>
          </Select>

          {!editing && (
            <Input
              id="u-password"
              label="Mot de passe"
              type="password"
              value={form.password}
              onChange={set('password')}
              hint="Au moins 8 caractères"
              required
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
    </div>
  )
}