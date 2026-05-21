import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/alnaqbi_logo.png'
import toast from 'react-hot-toast'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  function handleLogout() {
    logout()
    toast.success('Signed out')
    navigate('/login')
  }

  const linkClass = (path) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      location.pathname === path
        ? 'bg-slate-700 text-white'
        : 'text-slate-300 hover:text-white hover:bg-slate-700'
    }`

  return (
    <header className="bg-slate-900 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Brand — small logo */}
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="Al Naqbi & Partners"
              className="h-10 w-auto"
              style={{ mixBlendMode: 'screen' }}
            />
            <div className="hidden sm:block">
              <p className="text-white font-semibold text-sm leading-tight">
                Sanctions Screening
              </p>
              <p className="text-slate-400 text-xs">Compliance Portal</p>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex items-center gap-1">
            <Link to="/" className={linkClass('/')}>Search</Link>
            {user?.role === 'admin' && (
              <Link to="/admin" className={linkClass('/admin')}>Admin</Link>
            )}
          </nav>

          {/* User + logout */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-white text-sm font-medium">
                {user?.name || user?.email}
              </p>
              {user?.role === 'demo' ? (
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-500 text-white">
                  Demo
                </span>
              ) : (
                <p className="text-slate-400 text-xs capitalize">
                  {user?.role === 'admin' ? 'Administrator' : 'Standard'}
                </p>
              )}
            </div>
            <button onClick={handleLogout} className="btn-secondary text-sm py-1.5">
              Sign out
            </button>
          </div>

        </div>
      </div>
    </header>
  )
}
