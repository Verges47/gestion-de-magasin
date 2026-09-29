import { Construction } from 'lucide-react'
import Card from '../components/Card.jsx'

export default function ComingSoon() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md p-10 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <Construction className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-semibold text-slate-900">
          Bientôt disponible
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Ce module est en cours de développement. Il sera disponible dans une
          prochaine version.
        </p>
      </Card>
    </div>
  )
}