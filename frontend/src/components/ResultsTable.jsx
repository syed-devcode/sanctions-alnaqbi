const RISK_STYLES = {
  confirmed_match: 'bg-red-100 text-red-700 border border-red-300',
  possible_match:  'bg-amber-100 text-amber-700 border border-amber-300',
  clear:           'bg-green-100 text-green-700 border border-green-300',
}

const RISK_LABELS = {
  confirmed_match: 'Confirmed Match',
  possible_match:  'Possible Match',
  clear:           'Clear',
}

export function RiskBadge({ level }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${RISK_STYLES[level] || RISK_STYLES.clear}`}>
      {RISK_LABELS[level] || level}
    </span>
  )
}

export default function ResultsTable({ results, onRowClick }) {
  if (!results) return null

  if (results.length === 0) {
    return (
      <div className="card flex items-center gap-3 border-green-200 bg-green-50">
        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xl flex-shrink-0">✓</div>
        <div>
          <p className="font-semibold text-green-800">Clear — No Matches Found</p>
          <p className="text-sm text-green-600">This name does not appear on any monitored sanctions list.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">
          {results.length} match{results.length !== 1 ? 'es' : ''} found
        </h3>
        <span className="text-sm text-gray-500">Click a row for full details</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Risk</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Primary Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Matched Alias(es)</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Source</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Nationality</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {results.map((r, i) => (
              <tr
                key={r.entry_id || i}
                onClick={() => onRowClick(r)}
                className="hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3"><RiskBadge level={r.risk_level} /></td>
                <td className="px-4 py-3 font-medium text-gray-900">{r.primary_name}</td>
                <td className="px-4 py-3 text-gray-600">
                  {r.matched_aliases && r.matched_aliases.length > 1 ? (
                    <div className="space-y-0.5">
                      {r.matched_aliases.map((a, i) => (
                        <div key={i} className="text-sm leading-snug">
                          {a.alias_name}
                          <span className="ml-1.5 text-xs text-gray-400">
                            {(a.similarity_score * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    r.matched_alias
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${r.source === 'UN' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                    {r.source}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 capitalize">{r.entity_type}</td>
                <td className="px-4 py-3 text-gray-600">{r.nationality || '—'}</td>
                <td className="px-4 py-3 text-gray-600 font-mono">
                  {(r.similarity_score * 100).toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
