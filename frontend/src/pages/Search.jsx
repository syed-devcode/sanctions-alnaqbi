import { useState } from 'react'
import Navbar from '../components/Navbar'
import SearchBar from '../components/SearchBar'
import ResultsTable from '../components/ResultsTable'
import MatchModal from '../components/MatchModal'
import Footer from '../components/Footer'
import { RiskBadge } from '../components/ResultsTable'
import { searchAPI, reportAPI } from '../services/api'
import toast from 'react-hot-toast'

export default function Search() {
  const [loading, setLoading] = useState(false)
  const [searchResult, setSearchResult] = useState(null)  // { query, risk_level, results, searched_at }
  const [selectedMatch, setSelectedMatch] = useState(null)

  async function handleSearch(query) {
    setLoading(true)
    setSearchResult(null)
    try {
      const res = await searchAPI.search(query)
      setSearchResult({ ...res.data, searched_at: new Date().toISOString() })
    } catch (err) {
      toast.error(err.response?.data?.error || 'Search failed')
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

        {/* Search card */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Name Screening</h2>
          <p className="text-sm text-gray-500 mb-5">
            Search across UN Consolidated List and UAE Local Terrorists List using fuzzy matching.
          </p>
          <SearchBar onSearch={handleSearch} loading={loading} />
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
            {searchResult.results.length > 0 && (
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
