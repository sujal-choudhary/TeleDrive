import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  HomeIcon,
  ClockIcon,
  StarIcon,
  TrashIcon,
  Cog6ToothIcon,
  FolderPlusIcon,
} from '@heroicons/react/24/outline'
import { createFolder } from '../services/folders'

const navItems = [
  { to: '/', label: 'My Files', icon: HomeIcon, end: true },
  { to: '/recent', label: 'Recent', icon: ClockIcon },
  { to: '/starred', label: 'Starred', icon: StarIcon },
  { to: '/trash', label: 'Trash', icon: TrashIcon },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [folderName, setFolderName] = useState('')

  const handleCreateFolder = async (e) => {
    e.preventDefault()
    if (!folderName.trim()) return
    try {
      const folder = await createFolder(folderName.trim())
      setFolderName('')
      setShowNewFolder(false)
      navigate(`/folder/${folder.id}`)
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <aside className="flex w-60 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            T
          </div>
          <span className="text-lg font-bold text-gray-900">TeleDrive</span>
        </div>
      </div>

      <div className="px-3 pb-2">
        <button
          onClick={() => setShowNewFolder(true)}
          className="flex w-full items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600"
        >
          <FolderPlusIcon className="h-5 w-5" />
          New Folder
        </button>

        {showNewFolder && (
          <form onSubmit={handleCreateFolder} className="mt-2">
            <input
              autoFocus
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onBlur={() => setTimeout(() => setShowNewFolder(false), 200)}
              placeholder="Folder name"
              className="w-full rounded-lg border border-blue-300 px-3 py-2 text-sm outline-none"
            />
          </form>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t border-gray-200 p-3">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
            }`
          }
        >
          <Cog6ToothIcon className="h-5 w-5" />
          Settings
        </NavLink>
      </div>
    </aside>
  )
}