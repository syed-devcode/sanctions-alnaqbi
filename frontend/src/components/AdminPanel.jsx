import { useState, useEffect } from 'react'
import { syncAPI } from '../services/api'
import toast from 'react-hot-toast'

const STATUS_STYLES = {
  completed: 'bg-green-100 text-green-700',
  failed:    'bg-red-100 text-red-700',
  started:   'bg-blue-100 text-blue-700',
}

export default function AdminPanel() {
  const [source, setSource] = useState('ALL')
  const [syncing, setSyncing] = useState(false)
  const [syncLogs, setSyncLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(true)

  async function fetchSyncLogs() {
    setLoadingLogs(true)
    try {
      const res = await syncAPI.getLogs()
      setSyncLogs(res.data.logs)
    } catch {
      toast.error('Failed to load sync history')
    } finally {
      setLoadingLogs(false)
    }
  }

  useEffect(() => { fetchSyncLogs() }, [])

  async function handleSync() {
    setSyncing(true)
    try {
      await syncAPI.trigger(source)
      toast.success(`${source} sync started — check logs for progress`)
      setTimeout(fetchSyncLogs, 3000)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Sync failed to start')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Sync trigger card */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-1">Manual Data Sync</h3>
        <p className="text-sm text-gray-500 mb-5">
          Re-import sanctions data from the source files. Weekly automatic sync runs every Sunday at 02:00.
        </p>
        <div className="flex items-center gap-3">
          <select
            value={source}
            onChange={e => setSource(e.target.value)}
            className="input-field w-44"
          >
            <option value="ALL">Both Lists</option>
            <option value="UN">UN List only</option>
            <option value="UAE">UAE List only</option>
          </select>
          <button onClick={handleSync} disabled={syncing} className="btn-primary flex items-center gap-2">
            {syncing ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Starting…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Run Sync
              </>
            )}
          </button>
          <button onClick={fetchSyncLogs} className="btn-secondary text-sm">Refresh logs</button>
        </div>
      </div>

      {/* Sync history */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Sync History</h3>
        </div>
        {loadingLogs ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-700" />
          </div>
        ) : syncLogs.length === 0 ? (
          <p className="text-center py-8 text-gray-400">No sync history yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Started</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Source</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Records</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Trigger</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {syncLogs.map(log => {
                  const duration = log.completed_at
                    ? Math.round((new Date(log.completed_at) - new Date(log.started_at)) / 1000)
                    : null
                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(log.started_at).toLocaleString('en-GB')}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{log.source}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[log.status] || ''}`}>
                          {log.status}
                        </span>
                        {log.error_message && (
                          <p className="text-xs text-red-500 mt-0.5">{log.error_message}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{log.records_imported.toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-500 capitalize">{log.triggered_by}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {duration !== null ? `${duration}s` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
