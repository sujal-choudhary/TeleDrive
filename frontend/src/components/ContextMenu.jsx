import { useEffect } from 'react'

export default function ContextMenu({
  x,
  y,
  isTrashed = false,
  onClose,
  onOpen,
  onPreview,
  onDownload,
  onRename,
  onMove,
  onStar,
  onTrash,
  onRestore,
  onDelete,
}) {
  useEffect(() => {
    const handleClick = () => onClose()
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const menuStyle = {
    top: Math.min(y, window.innerHeight - 300),
    left: Math.min(x, window.innerWidth - 220),
  }

  return (
    <div
      className="fixed z-50 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
      style={menuStyle}
      onClick={(e) => e.stopPropagation()}
    >
      {isTrashed ? (
        <>
          {onRestore && (
            <button
              onClick={onRestore}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              Restore
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              Delete Permanently
            </button>
          )}
        </>
      ) : (
        <>
          {onOpen && (
            <button
              onClick={onOpen}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              Open
            </button>
          )}
          {onPreview && (
            <button
              onClick={onPreview}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              Preview
            </button>
          )}
          {onDownload && (
            <button
              onClick={onDownload}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              Download
            </button>
          )}
          <div className="my-1 border-t border-gray-100" />
          {onRename && (
            <button
              onClick={onRename}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              Rename
            </button>
          )}
          {onMove && (
            <button
              onClick={onMove}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              Move
            </button>
          )}
          {onStar && (
            <button
              onClick={onStar}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              Star / Unstar
            </button>
          )}
          <div className="my-1 border-t border-gray-100" />
          {onTrash && (
            <button
              onClick={onTrash}
              className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              Move to Trash
            </button>
          )}
        </>
      )}
    </div>
  )
}