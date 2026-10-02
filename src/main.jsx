import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// En local (XAMPP), l'app est servie sous /jvuim/dist/.
// Sur Railway, l'app est servie à la racine du domaine.
const basename = import.meta.env.BASE_URL === '/' ? '/' : '/jvuim/dist'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)