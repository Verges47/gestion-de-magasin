import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import PublicLayout from './layouts/PublicLayout.jsx'
import DashboardLayout from './layouts/DashboardLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import ComingSoon from './pages/ComingSoon.jsx'
import Settings from './pages/Settings.jsx'
import Produits from './pages/Produits.jsx'
import Categories from './pages/Categories.jsx'
import Fournisseurs from './pages/Fournisseurs.jsx'
import Stock from './pages/Stock.jsx'
import Ventes from './pages/Ventes.jsx'
import Commandes from './pages/Commandes.jsx'
import Utilisateurs from './pages/Utilisateurs.jsx'
import Rapports from './pages/Rapports.jsx'
import Inventaire from './pages/Inventaire.jsx'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/connexion" element={<Login />} />
        </Route>

        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/produits" element={<Produits />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/fournisseurs" element={<Fournisseurs />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/inventaire" element={<Inventaire />} />
          <Route path="/ventes" element={<Ventes />} />
          <Route path="/commandes" element={<Commandes />} />
          <Route path="/rapports" element={<Rapports />} />
          <Route path="/utilisateurs" element={<Utilisateurs />} />
          <Route path="/parametres" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
