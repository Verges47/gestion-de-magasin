import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// L'application est servie sous /jvuim/dist/ : le routeur doit être basé sur
// ce préfixe pour que les routes (/, /connexion, /produits…) fonctionnent
// en production comme en développement.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename="/jvuim/dist">
      <App />
    </BrowserRouter>
  </StrictMode>,
)