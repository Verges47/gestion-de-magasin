// Client HTTP minimal vers l'API PHP. L'URL de base est configurable via
// l'environnement Vite (fichier .env). Par défaut : /jvuim/api (servi par XAMPP).

const BASE_URL = import.meta.env.VITE_API_URL || '/jvuim/api'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

export async function apiFetch(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  let data = null
  try {
    data = await res.json()
  } catch {
    // Réponse vide ou non-JSON.
  }

  if (!res.ok) {
    throw new ApiError(data?.error || 'Erreur de connexion au serveur.', res.status)
  }

  return data
}