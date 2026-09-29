import { Outlet } from 'react-router-dom'
import Logo from '../components/Logo.jsx'

export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  )
}