import { useState } from 'react'

export default function SearchBar({ onSearch, loading, disabled = false }) {
  const [query, setQuery] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!disabled && query.trim().length >= 2) onSearch(query.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={disabled ? 'Demo limit reached' : 'Enter full name or alias to screen…'}
        className={`input-field flex-1 text-base py-3 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        minLength={2}
        disabled={disabled}
      />
      <button
        type="submit"
        disabled={loading || disabled || query.trim().length < 2}
        className="btn-primary px-6 py-3 text-base"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            Searching…
          </span>
        ) : 'Screen'}
      </button>
    </form>
  )
}
