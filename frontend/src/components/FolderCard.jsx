import { useState } from 'react'
import { FolderIcon, EllipsisVerticalIcon } from '@heroicons/react/24/outline'

export default function FolderCard({ folder, onOpen = null, onRename = null, onMove = null, onDelete = null }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })

  const handleContextMenu = (e) => {
    e.preventDefault()
    setMenuPos({ x: e.clientX, y: e.clientY })
    setMenuOpen(true)
  }

  const closeMenu = () => setMenuOpen(false)

  return (
    <div
      className="group relative cursor-pointer rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
      onClick={onOpen}
      onContextMenu={handleContextMenu}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-100 text-2xl">
          <FolderIcon className="h-7 w-7 text-yellow-600" />
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleContextMenu(e)
          }}
          className="rounded p-1 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-100"
        >
          <EllipsisVerticalIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-3">
        <p className="truncate text-sm font-medium text-gray-900" title={folder.name}>
          {folder.name}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {folder.subfolder_count ?? 0} folders · {folder.file_count ?? 0} files
        </p>
      </div>

      {menuOpen && (
        <div
          className="fixed z-50 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          style={{ top: menuPos.y, left: menuPos.x }}
        >
          {onRename && (
            <button
              onClick={() => { closeMenu(); onRename() }}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              Rename
            </button>
          )}
          {onMove && (
            <button
              onClick={() => { closeMenu(); onMove() }}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              Move
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => { closeMenu(); onDelete() }}
              className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}