import { useState, useEffect } from 'react'
import { auditAPI } from '../services/api'
import { RiskBadge } from './ResultsTable'
import toast from 'react-hot-toast'

export default function AuditLog() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  async function fetchLogs(p = 1) {
    setLoading(true)
    try {
      const res = await auditAPI.getLogs(p)
      setLogs(res.data.logs)
      setTotal(res.data.total)
      setPage(p)
    } catch {
      toast.error('Failed to load audit log')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLogs(1) }, [])

  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Search Audit Log</h3>
          <p className="text-sm text-gray-500">{total} total searches</p>
        </div>
        <button onClick={() => fetchLogs(page)} className="btn-secondary text-sm">Refresh</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-700" />
        </div>
      ) : logs.length === 0 ? (
        <p className="text-center py-10 text-gray-400">No searches recorded yet.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Date / Time</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">User</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Search Term</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Results</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(log.searched_at).toLocaleString('en-GB')}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{log.user_email}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{log.search_term}</td>
                    <td className="px-4 py-3 text-gray-600">{log.results_count}</td>
                    <td className="px-4 py-3"><RiskBadge level={log.risk_level} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 50 && (
            <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 50)}</p>
              <div className="flex gap-2">
                <button onClick={() => fetchLogs(page - 1)} disabled={page === 1} className="btn-secondary text-sm py-1">Previous</button>
                <button onClick={() => fetchLogs(page + 1)} disabled={page >= Math.ceil(total / 50)} className="btn-secondary text-sm py-1">Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
