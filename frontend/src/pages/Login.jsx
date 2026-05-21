import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LoginForm from '../components/LoginForm'
import Footer from '../components/Footer'
import logo from '../assets/alnaqbi_logo.png'

export default function Login() {
  const { user } = useAuth()
  if (user) return <Navigate to="/" replace />

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md flex flex-col items-center">

        {/* Logo — mix-blend-mode:screen removes the black background */}
        <div className="mb-6 flex items-center justify-center">
          <img
            src={logo}
            alt="Al Naqbi & Partners"
            className="h-28 w-auto"
            style={{ mixBlendMode: 'screen' }}
          />
        </div>

        {/* Subtitle */}
        <p className="text-slate-400 text-sm mb-8 tracking-wide">
          Sanctions Screening — Compliance Portal
        </p>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            Sign in to your account
          </h2>
          <LoginForm />
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          Unauthorized access is prohibited and monitored.
        </p>

        <Footer dark />
      </div>
    </div>
  )
}
