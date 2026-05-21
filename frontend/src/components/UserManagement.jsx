import { useState, useEffect } from 'react'
import { usersAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const ROLE_LABELS = { admin: 'Administrator', staff: 'Standard', demo: 'Demo' }

function Badge({ active }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

// ── Add User Modal ──────────────────────────────────────────
function AddUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff' })
  const [loading, setLoading] = useState(false)

  function set(field, val) { setForm(f => ({ ...f, [field]: val })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await usersAPI.create(form)
      toast.success(`User ${res.data.user.email} created`)
      onCreated(res.data.user)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Add New User</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} className="input-field" placeholder="Jane Smith" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
            <input type="email" required value={form.email} onChange={e => set('email', e.target.value)} className="input-field" placeholder="jane@alnaqbipartners.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
            <input type="password" required minLength={6} value={form.password} onChange={e => set('password', e.target.value)} className="input-field" placeholder="Min. 6 characters" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select value={form.role} onChange={e => set('role', e.target.value)} className="input-field">
              <option value="staff">Standard</option>
              <option value="admin">Administrator</option>
              <option value="demo">Demo</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Reset Password Modal ────────────────────────────────────
function ResetPasswordModal({ user, onClose }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await usersAPI.resetPassword(user.id, password)
      toast.success(`Password reset for ${user.email}`)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Reset Password</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">Set a new password for <strong>{user.email}</strong></p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="input-field" placeholder="Min. 6 characters" autoFocus />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Saving…' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Add Searches Modal ──────────────────────────────────────
function AddSearchesModal({ user, onClose, onUpdated }) {
  const [amount, setAmount] = useState(5)
  const [loading, setLoading] = useState(false)
  const used = user.demo_searches_used ?? 0
  const currentLimit = user.demo_search_limit ?? 10

  async function handleSubmit(e) {
    e.preventDefault()
    if (amount < 1) return
    setLoading(true)
    try {
      const res = await usersAPI.addDemoSearches(user.id, amount)
      toast.success(`Added ${amount} searches for ${user.email}`)
      onUpdated(res.data.user)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add searches')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Add Extra Searches</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            <strong>{user.email}</strong> — currently{' '}
            <span className="font-semibold text-amber-700">{used} / {currentLimit}</span> searches used
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Add extra searches</label>
            <input
              type="number"
              required
              min={1}
              max={10000}
              value={amount}
              onChange={e => setAmount(parseInt(e.target.value) || 0)}
              className="input-field"
              autoFocus
            />
          </div>
          <p className="text-xs text-gray-500">
            New limit will be: <strong>{currentLimit + (amount || 0)}</strong>{' '}
            (remaining: {currentLimit + (amount || 0) - used})
          </p>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading || amount < 1} className="btn-primary flex-1">
              {loading ? 'Saving…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Change Limit Modal ──────────────────────────────────────
function ChangeLimitModal({ user, onClose, onUpdated }) {
  const [limit, setLimit] = useState(user.demo_search_limit ?? 10)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (limit < 1) return
    setLoading(true)
    try {
      const res = await usersAPI.setDemoLimit(user.id, limit)
      toast.success(`Search limit set to ${limit} for ${user.email}`)
      onUpdated(res.data.user)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change limit')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Change Search Limit</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            <strong>{user.email}</strong> — current limit:{' '}
            <span className="font-semibold">{user.demo_search_limit ?? 10}</span>
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New total limit</label>
            <input
              type="number"
              required
              min={1}
              max={10000}
              value={limit}
              onChange={e => setLimit(parseInt(e.target.value) || 0)}
              className="input-field"
              autoFocus
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading || limit < 1} className="btn-primary flex-1">
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────
export default function UserManagement() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [resetTarget, setResetTarget] = useState(null)
  const [addSearchesTarget, setAddSearchesTarget] = useState(null)
  const [changeLimitTarget, setChangeLimitTarget] = useState(null)

  async function fetchUsers() {
    setLoading(true)
    try {
      const res = await usersAPI.list()
      setUsers(res.data.users)
    } catch {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  function handleCreated(newUser) {
    setUsers(u => [...u, newUser])
  }

  function handleDemoUpdated(updatedUser) {
    setUsers(u => u.map(x => x.id === updatedUser.id ? { ...x, ...updatedUser } : x))
  }

  async function toggleStatus(user) {
    const next = !user.is_active
    try {
      await usersAPI.updateStatus(user.id, next)
      setUsers(u => u.map(x => x.id === user.id ? { ...x, is_active: next } : x))
      toast.success(`${user.email} ${next ? 'activated' : 'deactivated'}`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status')
    }
  }

  async function changeRole(user, role) {
    try {
      await usersAPI.updateRole(user.id, role)
      setUsers(u => u.map(x => x.id === user.id ? { ...x, role } : x))
      toast.success(`Role updated to ${ROLE_LABELS[role]}`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update role')
    }
  }

  async function resetDemoCounter(user) {
    try {
      const res = await usersAPI.resetDemoCounter(user.id)
      setUsers(u => u.map(x => x.id === user.id ? { ...x, demo_searches_used: 0 } : x))
      toast.success(`Counter reset for ${user.email}`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset counter')
    }
  }

  return (
    <>
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">User Management</h3>
            <p className="text-sm text-gray-500">{users.length} user{users.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add User
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-700" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Name / Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Created</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => {
                  const isSelf = u.id === currentUser?.id
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{u.name || '—'}</p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          onChange={e => changeRole(u, e.target.value)}
                          disabled={isSelf}
                          className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="staff">Standard</option>
                          <option value="admin">Administrator</option>
                          <option value="demo">Demo</option>
                        </select>
                        {u.role === 'demo' && (
                          <p className="text-xs text-amber-700 mt-1 font-medium">
                            {u.demo_searches_used ?? 0} / {u.demo_search_limit ?? 10} searches used
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3"><Badge active={u.is_active} /></td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(u.created_at).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            onClick={() => setResetTarget(u)}
                            className="text-xs text-slate-600 hover:text-slate-900 border border-gray-200 rounded px-2 py-1 hover:bg-gray-50 transition-colors"
                          >
                            Reset Password
                          </button>
                          {!isSelf && (
                            <button
                              onClick={() => toggleStatus(u)}
                              className={`text-xs border rounded px-2 py-1 transition-colors ${
                                u.is_active
                                  ? 'text-red-600 border-red-200 hover:bg-red-50'
                                  : 'text-green-600 border-green-200 hover:bg-green-50'
                              }`}
                            >
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                          {u.role === 'demo' && (
                            <>
                              <button
                                onClick={() => resetDemoCounter(u)}
                                className="text-xs text-amber-700 border border-amber-200 rounded px-2 py-1 hover:bg-amber-50 transition-colors"
                              >
                                Reset Counter
                              </button>
                              <button
                                onClick={() => setAddSearchesTarget(u)}
                                className="text-xs text-blue-700 border border-blue-200 rounded px-2 py-1 hover:bg-blue-50 transition-colors"
                              >
                                Add Searches
                              </button>
                              <button
                                onClick={() => setChangeLimitTarget(u)}
                                className="text-xs text-purple-700 border border-purple-200 rounded px-2 py-1 hover:bg-purple-50 transition-colors"
                              >
                                Change Limit
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onCreated={handleCreated} />}
      {resetTarget && <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} />}
      {addSearchesTarget && (
        <AddSearchesModal
          user={addSearchesTarget}
          onClose={() => setAddSearchesTarget(null)}
          onUpdated={handleDemoUpdated}
        />
      )}
      {changeLimitTarget && (
        <ChangeLimitModal
          user={changeLimitTarget}
          onClose={() => setChangeLimitTarget(null)}
          onUpdated={handleDemoUpdated}
        />
      )}
    </>
  )
}
