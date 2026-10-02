import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En local (XAMPP), l'app est servie sous http://localhost/jvuim/dist/.
// Sur Railway, l'app est servie à la racine du domaine.
// La variable RAILWAY_ENVIRONMENT est automatiquement définie par Railway.
export default defineConfig({
  base: process.env.RAILWAY_ENVIRONMENT ? '/' : '/jvuim/dist/',
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