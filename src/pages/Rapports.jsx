import { useState, useEffect, useCallback } from 'react'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Warehouse,
  CalendarClock,
  Download,
  Loader2,
  Inbox,
  AlertTriangle,
  Package,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { useAuth } from '../context/AuthContext.jsx'
import { apiFetch, ApiError } from '../lib/api.js'
import { formatCurrency, formatDate, cn } from '../lib/utils.js'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import StatCard from '../components/StatCard.jsx'
import Badge from '../components/Badge.jsx'

export default function Rapports() {
  const { token } = useAuth()

  const [periode, setPeriode] = useState('jour')
  const [resume, setResume] = useState(null)
  const [produits, setProduits] = useState([])
  const [stockInfo, setStockInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [r, p, s] = await Promise.all([
        apiFetch(`/rapports.php?type=resume&periode=${periode}`, { token }),
        apiFetch('/rapports.php?type=ventes_par_produit', { token }),
        apiFetch('/rapports.php?type=stock_valeur', { token }),
      ])
      setResume(r)
      setProduits(p.produits)
      setStockInfo(s)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur de chargement.')
    } finally {
      setLoading(false)
    }
  }, [periode, token])

  useEffect(() => {
    load()
  }, [load])

  const chartData = (resume?.serie ?? []).map((s) => ({
    name: s.periode,
    ca: Number(s.ca),
    ventes: Number(s.nb_ventes),
  }))

  const bestSeller = produits[0]
  const worstSeller = produits.length > 0 ? produits[produits.length - 1] : null

  const exportCsv = () => {
    window.open(`/jvuim/api/rapports.php?type=export&format=csv`, '_blank')
  }

  const exportExcel = () => {
    window.open(`/jvuim/api/rapports.php?type=export&format=excel`, '_blank')
  }

  const exportPdf = () => {
    window.open(`/jvuim/api/rapports.php?type=export&format=pdf`, '_blank')
  }

  const PERIODES = [
    { value: 'jour', label: 'Jour' },
    { value: 'semaine', label: 'Semaine' },
    { value: 'mois', label: 'Mois' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Rapports
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Statistiques de vente, stock et export.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg ring-1 ring-slate-200">
            {PERIODES.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriode(p.value)}
                className={cn(
                  'px-3 py-2 text-sm font-medium first:rounded-l-lg last:rounded-r-lg',
                  periode === p.value
                    ? 'bg-brand-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button variant="secondary" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button variant="secondary" onClick={exportExcel}>
            <Download className="h-4 w-4" />
            Excel
          </Button>
          <Button variant="secondary" onClick={exportPdf}>
            <Download className="h-4 w-4" />
            PDF
          </Button>
        </div>
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
      ) : (
        <>
          {/* Indicateurs */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={BarChart3}
              label={`Ventes (${periode})`}
              value={resume?.totaux?.nb_ventes ?? 0}
              tone="blue"
              hint="nombre de ventes"
            />
            <StatCard
              icon={TrendingUp}
              label="Chiffre d’affaires"
              value={formatCurrency(resume?.totaux?.ca ?? 0)}
              tone="green"
            />
            <StatCard
              icon={Warehouse}
              label="Valeur du stock"
              value={formatCurrency(stockInfo?.valeur_stock ?? 0)}
              tone="blue"
            />
            <StatCard
              icon={CalendarClock}
              label="En rupture"
              value={stockInfo?.nb_ruptures ?? 0}
              tone="red"
              hint="sous le seuil d’alerte"
            />
          </div>

          {/* Graphique */}
          <Card className="p-5">
            <h2 className="mb-4 text-base font-semibold text-slate-900">
              Chiffre d’affaires par {periode}
            </h2>
            {chartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Inbox className="mb-3 h-8 w-8 text-slate-300" />
                <p className="text-sm text-slate-500">Aucune donnée de vente</p>
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                    <Bar dataKey="ca" fill="#1d63f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            {/* Produits les plus / moins vendus */}
            <Card className="overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-900">
                  Produits les plus / moins vendus
                </h2>
              </div>
              {produits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Inbox className="mb-3 h-8 w-8 text-slate-300" />
                  <p className="text-sm text-slate-500">Aucune vente</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {produits.slice(0, 10).map((p, i) => (
                    <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="w-6 text-center text-sm font-semibold text-slate-400">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {p.nom}
                        </p>
                      </div>
                      <span className="text-sm text-slate-500">
                        {p.qte_vendue} vendus
                      </span>
                      <span className="w-24 text-right text-sm font-semibold text-slate-900">
                        {formatCurrency(p.ca)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Péremptions proches */}
            <Card className="overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-900">
                  Produits proches de la péremption
                </h2>
              </div>
              {!stockInfo?.peremptions?.length ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Package className="mb-3 h-8 w-8 text-slate-300" />
                  <p className="text-sm text-slate-500">Aucun produit proche de la péremption</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {stockInfo.peremptions.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {p.nom}
                        </p>
                        <p className="text-xs text-slate-400">
                          Stock : {p.stock}
                        </p>
                      </div>
                      <Badge tone="amber">{formatDate(p.date_peremption)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
