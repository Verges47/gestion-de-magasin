import { useState } from 'react'
import { Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { ApiError } from '../lib/api.js'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import { roleLabel } from '../data/roles.js'

function Alert({ tone, children }) {
  const styles =
    tone === 'success'
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-red-50 text-red-700'
  return (
    <div className={`flex items-start gap-2 rounded-lg p-3 text-sm ${styles}`}>
      {tone === 'success' ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span>{children}</span>
    </div>
  )
}

export default function Settings() {
  const { user, changePassword, updateProfile } = useAuth()

  const [name, setName] = useState(user?.name ?? '')
  const [login, setLogin] = useState(user?.login ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)

  const [profileMsg, setProfileMsg] = useState(null)
  const [pwMsg, setPwMsg] = useState(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  const handleProfile = async (e) => {
    e.preventDefault()
    setProfileMsg(null)
    setSavingProfile(true)
    try {
      await updateProfile(name.trim(), login.trim(), email.trim(), phone.trim())
      setProfileMsg({ tone: 'success', text: 'Profil mis à jour.' })
    } catch (err) {
      setProfileMsg({
        tone: 'error',
        text:
          err instanceof ApiError
            ? err.message
            : 'Impossible de contacter le serveur.',
      })
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePassword = async (e) => {
    e.preventDefault()
    setPwMsg(null)

    if (newPw.length < 8) {
      setPwMsg({
        tone: 'error',
        text: 'Le nouveau mot de passe doit contenir au moins 8 caractères.',
      })
      return
    }
    if (newPw !== confirmPw) {
      setPwMsg({ tone: 'error', text: 'Les mots de passe ne correspondent pas.' })
      return
    }

    setSavingPw(true)
    try {
      await changePassword(currentPw, newPw)
      setPwMsg({ tone: 'success', text: 'Mot de passe modifié.' })
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
    } catch (err) {
      setPwMsg({
        tone: 'error',
        text:
          err instanceof ApiError
            ? err.message
            : 'Impossible de contacter le serveur.',
      })
    } finally {
      setSavingPw(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Paramètres
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Gérez vos informations d’authentification.
        </p>
      </div>

      {/* Profil */}
      <Card className="p-6">
        <h2 className="text-base font-semibold text-slate-900">Profil</h2>
        <p className="mt-1 text-sm text-slate-500">
          Rôle : {roleLabel(user?.role)}
        </p>

        <form onSubmit={handleProfile} className="mt-5 space-y-4">
          {profileMsg && (
            <Alert tone={profileMsg.tone}>{profileMsg.text}</Alert>
          )}
          <Input
            id="name"
            label="Nom complet"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            id="login"
            label="Identifiant"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
          />
          <Input
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            id="phone"
            label="Téléphone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Button type="submit" disabled={savingProfile}>
            {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer le profil
          </Button>
        </form>
      </Card>

      {/* Mot de passe */}
      <Card className="p-6">
        <h2 className="text-base font-semibold text-slate-900">
          Modifier le mot de passe
        </h2>

        <form onSubmit={handlePassword} className="mt-5 space-y-4">
          {pwMsg && <Alert tone={pwMsg.tone}>{pwMsg.text}</Alert>}

          <div className="relative">
            <Input
              id="current-pw"
              label="Mot de passe actuel"
              type={showPw ? 'text' : 'password'}
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label={
                showPw ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
              }
              className="absolute right-2 top-[34px] rounded p-1 text-slate-400 hover:text-slate-600"
            >
              {showPw ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>

          <Input
            id="new-pw"
            label="Nouveau mot de passe"
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            autoComplete="new-password"
            hint="Au moins 8 caractères"
          />
          <Input
            id="confirm-pw"
            label="Confirmer le mot de passe"
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            autoComplete="new-password"
          />
          <Button type="submit" disabled={savingPw}>
            {savingPw && <Loader2 className="h-4 w-4 animate-spin" />}
            Modifier le mot de passe
          </Button>
        </form>
      </Card>
    </div>
  )
}
