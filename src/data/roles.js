// Autorisations par rôle. Le rôle provient de l'API (champ "role" de l'utilisateur)
// et ce fichier sert uniquement à filtrer le menu et afficher un libellé en français.
// Ce n'est pas de la donnée métier : c'est de la logique d'accès.

export const ROLES = {
  administrateur: {
    label: 'Administrateur',
    menu: [
      'dashboard',
      'produits',
      'categories',
      'fournisseurs',
      'stock',
      'inventaire',
      'ventes',
      'commandes',
      'rapports',
      'utilisateurs',
      'parametres',
    ],
  },
  gerant: {
    label: 'Gérant',
    menu: [
      'dashboard',
      'produits',
      'categories',
      'fournisseurs',
      'stock',
      'inventaire',
      'ventes',
      'commandes',
      'rapports',
      'parametres',
    ],
  },
  magasinier: {
    label: 'Magasinier',
    menu: ['dashboard', 'stock', 'inventaire', 'commandes', 'parametres'],
  },
  caissier: {
    label: 'Caissier',
    menu: ['dashboard', 'ventes', 'parametres'],
  },
}

export function roleLabel(roleId) {
  return ROLES[roleId]?.label ?? roleId ?? 'Utilisateur'
}

export function roleMenu(roleId) {
  return ROLES[roleId]?.menu ?? []
}