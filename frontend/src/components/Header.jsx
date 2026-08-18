import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { MagnifyingGlassIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import UploadModal from './UploadModal'

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const [search, setSearch] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const searchTimeout = useRef(null)

  // Current folder id when viewing a folder page (parse from pathname)
  const folderMatch = location.pathname.match(/^\/folder\/(\d+)/)
  const currentFolderId = folderMatch ? Number(folderMatch[1]) : null

  // Reset search when navigating away from search results
  useEffect(() => {
    if (!location.search.includes('search=')) {
      setSearch('')
    }
  }, [location.pathname])

  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearch(value)

    clearTimeout(searchTimeout.current)

    searchTimeout.current = setTimeout(() => {
      if (value.trim()) {
        navigate(`/?search=${encodeURIComponent(value.trim())}`)
      } else {
        navigate('/')
      }
    }, 400)
  }

  return (
    <header className="flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-6">
      <div className="relative flex-1 max-w-xl">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={handleSearchChange}
          placeholder="Search files..."
          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm outline-none transition-colors focus:border-blue-400 focus:bg-white"
        />
      </div>

      <div className="ml-auto">
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <ArrowUpTrayIcon className="h-5 w-5" />
          Upload
        </button>
      </div>

      {showUpload && (
        <UploadModal
          folderId={currentFolderId}
          onClose={() => setShowUpload(false)}
        />
      )}
    </header>
  )
}