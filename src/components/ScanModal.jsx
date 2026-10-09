import { useState, useEffect, useRef } from 'react'
import {
  ScanLine,
  Loader2,
  AlertTriangle,
  Package,
  CheckCircle2,
  Camera,
  CameraOff,
} from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { useAuth } from '../context/AuthContext.jsx'
import { apiFetch, ApiError } from '../lib/api.js'
import { formatCurrency } from '../lib/utils.js'
import Modal from './Modal.jsx'
import Badge from './Badge.jsx'

// Modale de scan global : saisie/code scanné -> fiche produit instantanée (F8).
// Trois façons de renseigner le code : saisie manuelle, scanner USB « clavier »
// ou caméra de l'appareil.
export default function ScanModal({ open, onClose }) {
  const { token } = useAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null) // { ok, produit?, message? }
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setCode('')
      setResult(null)
      setCameraOn(false)
      setCameraError('')
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setCameraOn(false)
    }
  }, [open])

  // Recherche d'un produit à partir d'un code (saisi, scanné ou lu par la caméra).
  const lookup = async (value) => {
    if (!value || busy) return
    setBusy(true)
    try {
      const { produit } = await apiFetch(
        `/codes.php/scan?code=${encodeURIComponent(value)}`,
        { token },
      )
      setResult({ ok: true, produit })
    } catch (err) {
      setResult({
        ok: false,
        message:
          err instanceof ApiError
            ? err.message
            : 'Aucun produit trouvé pour ce code.',
      })
    } finally {
      setCode('')
      setBusy(false)
      if (!cameraOn) inputRef.current?.focus()
    }
  }

  const scan = (e) => {
    e.preventDefault()
    lookup(code.trim())
  }

  // Démarre / arrête la caméra selon l'état cameraOn.
  useEffect(() => {
    if (!open || !cameraOn) return undefined

    let cancelled = false
    const scanner = new Html5Qrcode('scan-reader')

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          // Un code est lu : on coupe la caméra et on cherche le produit.
          setCameraOn(false)
          lookup(decodedText.trim())
        },
        () => {},
      )
      .catch(() => {
        if (!cancelled) {
          setCameraError(
            "Impossible d'accéder à la caméra. Autorisez-la dans votre navigateur puis réessayez.",
          )
          setCameraOn(false)
        }
      })

    return () => {
      cancelled = true
      scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cameraOn])

  const toggleCamera = () => {
    setCameraError('')
    setResult(null)
    setCameraOn((on) => !on)
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

      <button
        type="button"
        onClick={toggleCamera}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        {cameraOn ? (
          <>
            <CameraOff className="h-4 w-4" />
            Arrêter la caméra
          </>
        ) : (
          <>
            <Camera className="h-4 w-4" />
            Scanner avec la caméra
          </>
        )}
      </button>

      {cameraOn && (
        <div
          id="scan-reader"
          className="mt-3 overflow-hidden rounded-lg border border-slate-200"
        />
      )}

      {cameraError && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {cameraError}
        </div>
      )}

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
