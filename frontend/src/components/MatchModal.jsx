import { useAuth } from '../context/AuthContext'
import { reportAPI } from '../services/api'
import { RiskBadge } from './ResultsTable'
import toast from 'react-hot-toast'

function Row({ label, value }) {
  if (!value) return null
  return (
    <div className="flex gap-4 py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm font-medium text-gray-500 w-36 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  )
}

export default function MatchModal({ match, query, searchedAt, onClose }) {
  const { user } = useAuth()

  async function handleExport() {
    try {
      toast.loading('Generating PDF…', { id: 'pdf' })
      const res = await reportAPI.generate({
        query,
        risk_level: match.risk_level,
        results: [match],
        searched_at: searchedAt,
      })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `screening-${match.primary_name.replace(/\s+/g, '-')}-${Date.now()}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF downloaded', { id: 'pdf' })
    } catch {
      toast.error('PDF generation failed', { id: 'pdf' })
    }
  }

  const info = match.additional_info || {}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{match.primary_name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">Match Details</p>
          </div>
          <div className="flex items-center gap-3">
            <RiskBadge level={match.risk_level} />
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-4 flex-1">
          <div className="grid grid-cols-1 gap-0">
            {/* Matched aliases — every alias that hit the search query */}
            <div className="flex gap-4 py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-500 w-36 flex-shrink-0">
                {match.matched_aliases?.length > 1 ? 'Matched Aliases' : 'Matched Alias'}
              </span>
              <div className="space-y-0.5">
                {match.matched_aliases?.length > 0 ? (
                  match.matched_aliases.map((a, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm text-gray-900">{a.alias_name}</span>
                      <span className="text-xs text-gray-400">{(a.similarity_score * 100).toFixed(0)}%</span>
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-gray-900">{match.matched_alias}</span>
                )}
              </div>
            </div>

            {/* All known aliases stored for this record */}
            {match.all_aliases && match.all_aliases.length > 0 && (
              <div className="py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-500 mb-2">All Known Aliases</p>
                <div className="space-y-1">
                  {match.all_aliases.map((a, i) => {
                    const isMatched = match.matched_aliases?.some(m => m.alias_name === a.alias_name)
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className={`text-sm flex-1 ${isMatched ? 'font-semibold text-slate-900' : 'text-gray-700'}`}>
                          {a.alias_name}
                        </span>
                        <div className="flex gap-1 flex-shrink-0">
                          {isMatched && (
                            <span className="text-xs px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded">matched</span>
                          )}
                          {a.alias_type === 'primary' && (
                            <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">primary</span>
                          )}
                          {a.quality && (
                            <span className="text-xs text-gray-400 capitalize">{a.quality}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <Row label="Source List" value={match.source === 'UN' ? 'United Nations Consolidated List' : 'UAE Local Terrorists List'} />
            <Row label="Entity Type" value={match.entity_type?.charAt(0).toUpperCase() + match.entity_type?.slice(1)} />
            <Row label="Similarity Score" value={match.similarity_score ? `${(match.similarity_score * 100).toFixed(1)}%` : null} />
            <Row label="Nationality" value={match.nationality} />
            <Row label="Date of Birth" value={match.dob} />
            <Row label="Listed On" value={match.listed_on} />
            <Row label="Reference No." value={info.reference_number} />
            <Row label="UN List Type" value={info.un_list_type} />
            <Row label="Program ID" value={info.program_id} />
            <Row label="Birth Place" value={info.birth_place} />
            <Row label="Interpol Link" value={info.interpol_link} />
            {info.comments && (
              <div className="py-2">
                <p className="text-sm font-medium text-gray-500 mb-1">Comments</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 leading-relaxed">{info.comments}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50 rounded-b-2xl">
          <p className="text-xs text-gray-400">Screened by {user?.email}</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary text-sm">Close</button>
            <button onClick={handleExport} className="btn-primary text-sm flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              Export PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
