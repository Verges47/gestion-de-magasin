import {
  LayoutDashboard,
  Package,
  Tags,
  Truck,
  Boxes,
  ClipboardList,
  ShoppingCart,
  FileText,
  BarChart3,
  Users,
  Settings,
} from 'lucide-react'

// Entrées de menu. Le filtrage selon le rôle est fait via ROLES (data/roles.js).
export const NAV_ITEMS = [
  { key: 'dashboard', label: 'Tableau de bord', to: '/dashboard', icon: LayoutDashboard },
  { key: 'produits', label: 'Produits', to: '/produits', icon: Package },
  { key: 'categories', label: 'Catégories', to: '/categories', icon: Tags },
  { key: 'fournisseurs', label: 'Fournisseurs', to: '/fournisseurs', icon: Truck },
  { key: 'stock', label: 'Stock', to: '/stock', icon: Boxes },
  { key: 'inventaire', label: 'Inventaire', to: '/inventaire', icon: ClipboardList },
  { key: 'ventes', label: 'Ventes / Caisse', to: '/ventes', icon: ShoppingCart },
  { key: 'commandes', label: 'Commandes', to: '/commandes', icon: FileText },
  { key: 'rapports', label: 'Rapports', to: '/rapports', icon: BarChart3 },
  { key: 'utilisateurs', label: 'Utilisateurs', to: '/utilisateurs', icon: Users },
  { key: 'parametres', label: 'Paramètres', to: '/parametres', icon: Settings },
]
