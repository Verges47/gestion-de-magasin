import { Link } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import Button from '../components/Button.jsx'

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl text-center">
        <div className="mb-6 flex justify-center">
          <Logo size="lg" />
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          <span className="text-brand-600">StockScan</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-lg text-slate-500">
          Gestion de produits, stock et ventes.
        </p>

        <div className="mt-12">
          <Button asChild size="lg">
            <Link to="/connexion">Se connecter</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}