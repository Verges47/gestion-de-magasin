// Concaténation de classes conditionnelles, sans dépendance externe.
export function cn(...inputs) {
  return inputs.filter(Boolean).join(' ')
}

// Format monétaire FCFA (monnaie locale).
export function formatCurrency(value) {
  const n = Number(value) || 0
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' FCFA'
}

export function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('fr-FR')
}