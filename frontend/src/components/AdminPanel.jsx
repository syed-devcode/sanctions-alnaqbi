import { useState, useEffect, useRef, useCallback } from 'react'
import { syncAPI } from '../services/api'
import toast from 'react-hot-toast'

const STATUS_STYLES = {
  completed: 'bg-green-100 text-green-700',
  failed:    'bg-red-100 text-red-700',
  started:   'bg-yellow-100 text-yellow-700',
}

const LOG_STATUS_STYLES = {
  completed: 'bg-green-100 text-green-700',
  failed:    'bg-red-100 text-red-700',
  started:   'bg-blue-100 text-blue-700',
}

const SOURCES = [
  { key: 'UN',  label: 'UN Consolidated List',     url: 'scsanctions.un.org' },
  { key: 'UAE', label: 'UAE Local Terrorists List', url: 'data.opensanctions.org' },
]

function formatDateTime(dt) {
  if (!dt) return null
  return new Date(dt).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminPanel() {
  const [source, setSource]             = useState('ALL')
  const [syncing, setSyncing]           = useState(false)
  const [syncLogs, setSyncLogs]         = useState([])
  const [loadingLogs, setLoadingLogs]   = useState(true)
  const [sourceStatus, setSourceStatus] = useState({ UN: null, UAE: null })
  const [loadingStatus, setLoadingStatus] = useState(true)
  const pollRef = useRef(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await syncAPI.getStatus()
      setSourceStatus(res.data.status)
    } catch {
      // silent — stale cards are better than an error toast on every poll
    } finally {
      setLoadingStatus(false)
    }
  }, [])

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

  async function fetchAll() {
    await Promise.all([fetchStatus(), fetchSyncLogs()])
  }

  useEffect(() => {
    fetchAll()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchStatus])

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current)
    let attempts = 0
    pollRef.current = setInterval(async () => {
      attempts++
      await fetchAll()
      if (attempts >= 78) {          // stop after 6.5 minutes (covers 5-min sync timeout)
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }, 5000)
  }

  async function handleSync() {
    setSyncing(true)
    try {
      await syncAPI.trigger(source)
      toast.success(`${source} sync started — status updates every 5s`)
      startPolling()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Sync failed to start')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* ── Data source status cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SOURCES.map(({ key, label, url }) => {
          const st = sourceStatus[key]
          const isInProgress = st?.last_sync_status === 'started'

          return (
            <div key={key} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">{label}</h4>
                  <p className="text-xs text-gray-400 mt-0.5">{url}</p>
                </div>

                {loadingStatus ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-400" />
                ) : isInProgress ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                    <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    Syncing…
                  </span>
                ) : st?.last_sync_status ? (
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[st.last_sync_status] || ''}`}>
                    {st.last_sync_status}
                  </span>
                ) : null}
              </div>

              {loadingStatus ? (
                <div className="space-y-2">
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
                </div>
              ) : (
                <dl className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">Records in database</dt>
                    <dd className="font-medium text-gray-900">
                      {st?.total_records != null ? st.total_records.toLocaleString() : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">Last synced</dt>
                    <dd className="text-gray-700">
                      {st?.last_sync_at ? formatDateTime(st.last_sync_at) : 'Never'}
                    </dd>
                  </div>
                  {st?.last_sync_status === 'completed' && (
                    <div className="flex justify-between text-sm">
                      <dt className="text-gray-500">Added in last sync</dt>
                      <dd className="font-medium text-green-700">
                        +{(st.last_records_imported ?? 0).toLocaleString()}
                      </dd>
                    </div>
                  )}
                  {st?.last_sync_status === 'failed' && st.last_error && (
                    <p className="text-xs text-red-500 mt-2 break-words">{st.last_error}</p>
                  )}
                  {!st && (
                    <p className="text-xs text-gray-400 mt-1">No sync has been run yet.</p>
                  )}
                </dl>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Manual sync trigger ── */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-1">Manual Data Sync</h3>
        <p className="text-sm text-gray-500 mb-5">
          Downloads fresh data directly from the official source URLs. Auto-sync runs every Sunday at midnight.
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Run Sync
              </>
            )}
          </button>

          <button onClick={fetchAll} className="btn-secondary text-sm">Refresh</button>
        </div>
      </div>

      {/* ── Sync history table ── */}
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
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Records Added</th>
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
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${LOG_STATUS_STYLES[log.status] || ''}`}>
                          {log.status}
                        </span>
                        {log.error_message && (
                          <p className="text-xs text-red-500 mt-0.5">{log.error_message}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {log.status === 'completed' ? `+${log.records_imported.toLocaleString()}` : '—'}
                      </td>
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
