import { useState } from 'react'
import Navbar from '../components/Navbar'
import SearchBar from '../components/SearchBar'
import ResultsTable from '../components/ResultsTable'
import MatchModal from '../components/MatchModal'
import Footer from '../components/Footer'
import { RiskBadge } from '../components/ResultsTable'
import { searchAPI, reportAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const DEMO_LIMIT = 10

export default function Search() {
  const { user, updateUser } = useAuth()
  const isDemo = user?.role === 'demo'

  // Initialise from stored user so the banner is correct right after login
  const [remainingSearches, setRemainingSearches] = useState(
    isDemo ? DEMO_LIMIT - (user?.demo_searches_used ?? 0) : null
  )
  const [limitReached, setLimitReached] = useState(
    isDemo ? (user?.demo_searches_used ?? 0) >= DEMO_LIMIT : false
  )

  const [loading, setLoading] = useState(false)
  const [searchResult, setSearchResult] = useState(null)
  const [selectedMatch, setSelectedMatch] = useState(null)

  async function handleSearch(query) {
    if (limitReached) return
    setLoading(true)
    setSearchResult(null)
    try {
      const res = await searchAPI.search(query)
      setSearchResult({ ...res.data, searched_at: new Date().toISOString() })

      // Update demo counter from response
      if (isDemo && res.data.remainingSearches !== null) {
        const used = DEMO_LIMIT - res.data.remainingSearches
        setRemainingSearches(res.data.remainingSearches)
        setLimitReached(res.data.remainingSearches <= 0)
        updateUser({ demo_searches_used: used })
      }
    } catch (err) {
      const data = err.response?.data
      if (data?.limitReached) {
        setLimitReached(true)
        setRemainingSearches(0)
        updateUser({ demo_searches_used: DEMO_LIMIT })
        toast.error(data.error)
      } else {
        toast.error(data?.error || 'Search failed')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleExportAll() {
    if (!searchResult) return
    try {
      toast.loading('Generating PDF…', { id: 'pdf-all' })
      const res = await reportAPI.generate({
        query: searchResult.query,
        risk_level: searchResult.risk_level,
        results: searchResult.results,
        searched_at: searchResult.searched_at,
      })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `sanctions-report-${Date.now()}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF downloaded', { id: 'pdf-all' })
    } catch {
      toast.error('PDF generation failed', { id: 'pdf-all' })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Demo banner */}
        {isDemo && (
          limitReached ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
              <p className="font-semibold text-red-800 text-sm">Demo limit reached</p>
              <p className="text-sm text-red-700 mt-0.5">
                You have used all 10 demo searches. Please contact{' '}
                <a href="mailto:syed.faisal@alnaqbipartners.com" className="underline font-medium">
                  syed.faisal@alnaqbipartners.com
                </a>{' '}
                to upgrade your account.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 flex items-center justify-between">
              <p className="text-sm text-amber-900">
                <span className="font-semibold">Demo Account</span>
                {' — '}
                <span className="font-bold">{remainingSearches} of {DEMO_LIMIT}</span> searches remaining
              </p>
              <div className="flex gap-0.5 ml-4">
                {Array.from({ length: DEMO_LIMIT }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 w-4 rounded-sm ${
                      i < DEMO_LIMIT - remainingSearches ? 'bg-amber-400' : 'bg-amber-200'
                    }`}
                  />
                ))}
              </div>
            </div>
          )
        )}

        {/* Search card */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Name Screening</h2>
          <p className="text-sm text-gray-500 mb-5">
            Search across UN Consolidated List and UAE Local Terrorists List using fuzzy matching.
          </p>
          <SearchBar onSearch={handleSearch} loading={loading} disabled={limitReached} />
        </div>

        {/* Result summary banner */}
        {searchResult && !loading && (
          <div className={`rounded-xl border px-5 py-4 flex items-center justify-between ${
            searchResult.risk_level === 'confirmed_match'
              ? 'bg-red-50 border-red-200'
              : searchResult.risk_level === 'possible_match'
              ? 'bg-amber-50 border-amber-200'
              : 'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-center gap-4">
              <RiskBadge level={searchResult.risk_level} />
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Query: <span className="font-bold">"{searchResult.query}"</span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {searchResult.count} match{searchResult.count !== 1 ? 'es' : ''} ·{' '}
                  {new Date(searchResult.searched_at).toLocaleString('en-GB')}
                </p>
              </div>
            </div>
            {searchResult.results.length > 0 && !isDemo && (
              <button onClick={handleExportAll} className="btn-secondary text-sm flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                Export Full Report
              </button>
            )}
          </div>
        )}

        {/* Results table */}
        {searchResult && (
          <ResultsTable results={searchResult.results} onRowClick={setSelectedMatch} />
        )}

        {/* Placeholder when no search yet */}
        {!searchResult && !loading && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">🔍</div>
            <p className="font-medium">Enter a name above to begin screening</p>
            <p className="text-sm mt-1">Searches are logged for compliance purposes</p>
          </div>
        )}
      </main>

      {/* Match detail modal */}
      {selectedMatch && (
        <MatchModal
          match={selectedMatch}
          query={searchResult?.query}
          searchedAt={searchResult?.searched_at}
          onClose={() => setSelectedMatch(null)}
        />
      )}
      <Footer />
    </div>
  )
}
