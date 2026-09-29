import { useState, useEffect, useRef } from 'react'
import {
  ScanLine,
  Loader2,
  AlertTriangle,
  Package,
  CheckCircle2,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { apiFetch, ApiError } from '../lib/api.js'
import { formatCurrency } from '../lib/utils.js'
import Modal from './Modal.jsx'
import Badge from './Badge.jsx'

// Modale de scan global : saisie/code scanné -> fiche produit instantanée (F8).
export default function ScanModal({ open, onClose }) {
  const { token } = useAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null) // { ok, produit?, message? }
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setCode('')
      setResult(null)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const scan = async (e) => {
    e.preventDefault()
    const value = code.trim()
    if (!value || busy) return
    setBusy(true)
    try {
      const { produit } = await apiFetch(
        `/codes.php/scan?code=${encodeURIComponent(value)}`,
        { token },
      )
      setResult({ ok: true, produit })
      setCode('')
    } catch (err) {
      setResult({
        ok: false,
        message:
          err instanceof ApiError
            ? err.message
            : 'Aucun produit trouvé pour ce code.',
      })
      setCode('')
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Scanner un produit">
      <form onSubmit={scan} className="relative">
        <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Scannez ou saisissez un code…"
          autoFocus
          className="w-full rounded-lg border border-slate-300 bg-slate-50 py-3 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
      </form>

      {busy && (
        <div className="mt-4 flex items-center justify-center gap-2 py-4 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Recherche…
        </div>
      )}

      {result && !busy && (
        <div className="mt-4">
          {result.ok ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">Produit trouvé</span>
              </div>
              <div className="mt-3 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600">
                  <Package className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">
                    {result.produit.nom}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Code : {result.produit.valeur_code}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(result.produit.prix_vente)}
                    </span>
                    {Number(result.produit.stock) > 0 ? (
                      <Badge tone="green">Stock : {result.produit.stock}</Badge>
                    ) : (
                      <Badge tone="red">Rupture</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {result.message}
            </div>
          )}
        </div>
      )}

      <p className="mt-4 text-center text-xs text-slate-400">
        Un scanner USB « clavier » saisit le code et valide avec Entrée
        automatiquement.
      </p>
    </Modal>
  )
}