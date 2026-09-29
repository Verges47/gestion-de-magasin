import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// L'application est déployée sous http://localhost/jvuim/dist/ (dossier htdocs
// de XAMPP). Les assets du build sont donc référencés sous /jvuim/dist/.
// En développement, Vite proxy les requêtes /jvuim vers Apache (port 80)
// qui sert les fichiers PHP de l'API.
export default defineConfig({
  base: '/jvuim/dist/',
  plugins: [react()],
  server: {
    proxy: {
      '/jvuim': {
        target: 'http://localhost',
        changeOrigin: true,
      },
    },
  },
})