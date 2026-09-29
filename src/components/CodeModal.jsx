import { useState, useEffect, useCallback } from 'react'
import {
  Barcode,
  QrCode,
  Plus,
  Trash2,
  Loader2,
  Inbox,
  AlertTriangle,
  Sparkles,
  Star,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { apiFetch, ApiError } from '../lib/api.js'
import Badge from '../components/Badge.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import Select from '../components/Select.jsx'
import Modal from '../components/Modal.jsx'

const TYPE_LABELS = { EAN13: 'EAN-13', UPC: 'UPC', CODE128: 'Code 128', QR: 'QR code' }

export default function CodeModal({ produit, open, onClose, onChanged }) {
  const { token } = useAuth()

  const [codes, setCodes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [mode, setMode] = useState('associer') // 'associer' | 'generer'
  const [typeCode, setTypeCode] = useState('CODE128')
  const [valeur, setValeur] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    if (!produit) return
    setLoading(true)
    setError('')
    try {
      const { codes } = await apiFetch(`/codes.php?produit=${produit.id}`, { token })
      setCodes(codes)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur de chargement.')
    } finally {
      setLoading(false)
    }
  }, [produit, token])

  useEffect(() => {
    if (open && produit) {
      load()
      setMode('associer')
      setTypeCode('CODE128')
      setValeur('')
      setFormError('')
    }
  }, [open, produit, load])

  const handleAdd = async (e) => {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      const body =
        mode === 'generer'
          ? { id_produit: produit.id, generer: true }
          : { id_produit: produit.id, type_code: typeCode, valeur_code: valeur }
      await apiFetch('/codes.php', { method: 'POST', token, body })
      setValeur('')
      await load()
      onChanged?.()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erreur d’enregistrement.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (code) => {
    if (!window.confirm(`Supprimer le code « ${code.valeur_code} » ?`)) return
    try {
      await apiFetch(`/codes.php/${code.id}`, { method: 'DELETE', token })
      load()
      onChanged?.()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Codes — ${produit?.nom ?? ''}`} wide>
      <div className="space-y-5">
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Liste des codes */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
          </div>
        ) : codes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Inbox className="mb-2 h-7 w-7 text-slate-300" />
            <p className="text-sm text-slate-500">Aucun code associé</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {codes.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                {c.type_code === 'QR' ? (
                  <QrCode className="h-5 w-5 text-slate-400" />
                ) : (
                  <Barcode className="h-5 w-5 text-slate-400" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm text-slate-900">{c.valeur_code}</p>
                  <p className="text-xs text-slate-400">{TYPE_LABELS[c.type_code]}</p>
                </div>
                {Number(c.est_principal) === 1 && (
                  <Badge tone="blue">
                    <Star className="h-3 w-3" />
                    Principal
                  </Badge>
                )}
                <button
                  onClick={() => handleDelete(c)}
                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  title="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Ajout / génération */}
        <form onSubmit={handleAdd} className="space-y-4 rounded-lg border border-slate-200 p-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('associer')}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                mode === 'associer'
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Associer un code existant
            </button>
            <button
              type="button"
              onClick={() => setMode('generer')}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                mode === 'generer'
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Générer un code interne
            </button>
          </div>

          {formError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {formError}
            </div>
          )}

          {mode === 'associer' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                id="code-type"
                label="Symbologie"
                value={typeCode}
                onChange={(e) => setTypeCode(e.target.value)}
              >
                <option value="CODE128">Code 128 (interne)</option>
                <option value="EAN13">EAN-13 (13 chiffres)</option>
                <option value="UPC">UPC (12 chiffres)</option>
                <option value="QR">QR code</option>
              </Select>
              <Input
                id="code-valeur"
                label="Valeur du code"
                value={valeur}
                onChange={(e) => setValeur(e.target.value)}
                placeholder={
                  typeCode === 'EAN13'
                    ? '13 chiffres'
                    : typeCode === 'UPC'
                      ? '12 chiffres'
                      : 'Valeur du code'
                }
                required
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-brand-50 p-3 text-sm text-brand-700">
              <Sparkles className="h-4 w-4" />
              Un code interne unique (Code 128) sera généré automatiquement.
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'generer' ? (
                <>
                  <Plus className="h-4 w-4" />
                  Générer
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Associer
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  )
}