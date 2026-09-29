// Logo de l'entreprise (sunviaton_logo.png). L'image est large (ratio ~1.95:1),
// on fixe la hauteur et on laisse la largeur s'adapter automatiquement.
// BASE_URL tient compte du préfixe de déploiement (/jvuim/dist/ en production).
const BASE = import.meta.env.BASE_URL || '/'

export default function Logo({ size = 'md' }) {
  const h = size === 'lg' ? 'h-12' : 'h-9'

  return (
    <img
      src={`${BASE}sunviaton_logo.png`}
      alt="Logo Sunviaton"
      className={`${h} w-auto object-contain`}
    />
  )
}