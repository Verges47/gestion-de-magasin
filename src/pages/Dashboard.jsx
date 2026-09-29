import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Banknote,
  PackageX,
  Warehouse,
  CalendarClock,
  Plus,
  ScanLine,
  ShoppingCart,
  ClipboardList,
  Inbox,
  TrendingUp,
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
import { apiFetch } from '../lib/api.js'
import { formatCurrency, formatDate, cn } from '../lib/utils.js'
import StatCard from '../components/StatCard.jsx'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import Badge from '../components/Badge.jsx'

function EmptyState({ title, text }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <Inbox className="mb-3 h-8 w-8 text-slate-300" />
      <p className="text-sm font-medium text-slate-600">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{text}</p>
    </div>
  )
}

export default function Dashboard() {
  const { user, token } = useAuth()
  const [resume, setResume] = useState(null)
  const [stockInfo, setStockInfo] = useState(null)
  const [mouvements, setMouvements] = useState([])
  const [ventesJour, setVentesJour] = useState(0)

  const load = useCallback(async () => {
    try {
      const [r, s, m] = await Promise.all([
        apiFetch('/rapports.php?type=resume&periode=jour', { token }),
        apiFetch('/rapports.php?type=stock_valeur', { token }),
        apiFetch('/stock.php/mouvements', { token }),
      ])
      setResume(r)
      setStockInfo(s)
      setMouvements(m.mouvements ?? [])

      // Ventes du jour : on somme la série du jour (ou 0).
      const today = new Date().toISOString().slice(0, 10)
      const todayRow = (r.serie ?? []).find((s) => s.periode === today)
      setVentesJour(todayRow ? Number(todayRow.ca) : 0)
    } catch {
      // Silencieux : le tableau de bord reste affichable.
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const chartData = (resume?.serie ?? []).map((s) => ({
    name: s.periode.slice(5),
    ca: Number(s.ca),
  }))

  const alertes = (resume?.serie ?? []).length > 0 ? [] : []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Bonjour, {user?.name?.split(' ')[0] ?? ''}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Voici l’état de votre magasin aujourd’hui.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="primary" size="sm">
            <Link to="/produits">
              <Plus className="h-4 w-4" />
              Nouveau produit
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link to="/ventes">
              <ShoppingCart className="h-4 w-4" />
              Nouvelle vente
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link to="/stock">
              <ClipboardList className="h-4 w-4" />
              Stock
            </Link>
          </Button>
        </div>
      </div>

      {/* Cartes de statistiques */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Banknote}
          label="Ventes du jour"
          value={formatCurrency(ventesJour)}
          tone="blue"
          hint={`${resume?.totaux?.nb_ventes ?? 0} vente(s) sur 30 jours`}
        />
        <StatCard
          icon={PackageX}
          label="Produits en rupture"
          value={stockInfo?.nb_ruptures ?? 0}
          tone="red"
          hint="sous le seuil d’alerte"
        />
        <StatCard
          icon={Warehouse}
          label="Valeur du stock"
          value={formatCurrency(stockInfo?.valeur_stock ?? 0)}
          tone="green"
          hint="au prix d’achat"
        />
        <StatCard
          icon={CalendarClock}
          label="Proches péremption"
          value={stockInfo?.peremptions?.length ?? 0}
          tone="amber"
          hint="dans les 30 jours"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Graphique des ventes */}
        <Card className="p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Ventes sur 30 jours
            </h2>
            <TrendingUp className="h-4 w-4 text-slate-400" />
          </div>
          {chartData.length === 0 ? (
            <EmptyState
              title="Aucune donnée de vente"
              text="Le graphique s’affichera dès que des ventes seront enregistrées."
            />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Bar dataKey="ca" fill="#1d63f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Alertes de stock */}
        <Card className="p-5">
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            Alertes de stock
          </h2>
          {alertes.length === 0 ? (
            <EmptyState
              title={stockInfo?.nb_ruptures > 0 ? `${stockInfo.nb_ruptures} produit(s) en rupture` : 'Aucune alerte'}
              text="Les alertes apparaîtront ici lorsqu’un produit passera sous son seuil."
            />
          ) : (
            <div className="space-y-2">
              {alertes.map((a) => (
                <div key={a.id} className="flex items-center justify-between">
                  <span className="text-sm">{a.nom}</span>
                  <Badge tone="red">{a.stock}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Derniers mouvements de stock */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Derniers mouvements de stock
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/stock">Voir tout</Link>
          </Button>
        </div>
        {mouvements.length === 0 ? (
          <EmptyState
            title="Aucun mouvement"
            text="Les entrées et sorties de stock s’afficheront ici."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {mouvements.slice(0, 8).map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                <Badge
                  tone={
                    m.type === 'entree'
                      ? 'green'
                      : m.type === 'sortie'
                        ? 'red'
                        : 'amber'
                  }
                >
                  {m.quantite > 0 ? '+' : ''}
                  {m.quantite}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {m.produit_nom}
                  </p>
                  <p className="text-xs text-slate-400">
                    {m.type} · {formatDate(m.date)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}