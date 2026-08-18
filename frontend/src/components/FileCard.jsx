import { useState } from 'react'
import { StarIcon as StarOutline, EllipsisVerticalIcon } from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import { formatFileSize, getFileConfig } from '../utils/fileTypes'
import ContextMenu from './ContextMenu'
import { updateFile } from '../services/files'

export default function FileCard({ file, onOpen, onPreview, onRename, onMove, onTrash, onDelete, onRestore, showFolder = true }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const config = getFileConfig(file)

  const handleContextMenu = (e) => {
    e.preventDefault()
    setMenuPos({ x: e.clientX, y: e.clientY })
    setMenuOpen(true)
  }

  const handleStar = async (e) => {
    e.stopPropagation()
    try {
      const updated = await updateFile(file.id, { is_starred: !file.is_starred })
      onOpen?.() // refresh
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div
      className="group relative cursor-pointer rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
      onClick={onOpen}
      onDoubleClick={() => onPreview?.()}
      onContextMenu={handleContextMenu}
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg text-2xl ${config.color}`}>
          {config.icon}
        </div>
        <button
          onClick={handleStar}
          className="rounded-full p-1 text-gray-300 hover:text-yellow-500"
          title={file.is_starred ? 'Unstar' : 'Star'}
        >
          {file.is_starred ? (
            <StarSolid className="h-5 w-5 text-yellow-500" />
          ) : (
            <StarOutline className="h-5 w-5" />
          )}
        </button>
      </div>

      <div className="mt-3">
        <p className="truncate text-sm font-medium text-gray-900" title={file.name}>
          {file.name}
        </p>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs text-gray-500">{formatFileSize(file.file_size)}</span>
          {showFolder && file.folder && (
            <span className="truncate text-xs text-gray-400">{file.folder.name}</span>
          )}
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation()
          handleContextMenu(e)
        }}
        className="absolute bottom-3 right-3 rounded p-1 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-100"
      >
        <EllipsisVerticalIcon className="h-5 w-5" />
      </button>

      {menuOpen && (
        <ContextMenu
          x={menuPos.x}
          y={menuPos.y}
          isTrashed={file.is_trashed}
          onClose={() => setMenuOpen(false)}
          onOpen={() => { setMenuOpen(false); onOpen?.() }}
          onPreview={() => { setMenuOpen(false); onPreview?.() }}
          onRename={() => { setMenuOpen(false); onRename?.() }}
          onMove={() => { setMenuOpen(false); onMove?.() }}
          onStar={() => { setMenuOpen(false); handleStar({ stopPropagation: () => {} }) }}
          onTrash={() => { setMenuOpen(false); onTrash?.() }}
          onRestore={() => { setMenuOpen(false); onRestore?.() }}
          onDelete={() => { setMenuOpen(false); onDelete?.() }}
        />
      )}
    </div>
  )
}