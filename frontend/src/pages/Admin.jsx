import Navbar from '../components/Navbar'
import AdminPanel from '../components/AdminPanel'
import AuditLog from '../components/AuditLog'
import UserManagement from '../components/UserManagement'
import Footer from '../components/Footer'

export default function Admin() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-gray-500 mt-1">Manage data sources and monitor compliance activity.</p>
        </div>

        <UserManagement />
        <AdminPanel />
        <AuditLog />
      </main>
      <Footer />
    </div>
  )
}
