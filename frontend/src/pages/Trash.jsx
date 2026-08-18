import { useEffect, useState, useCallback } from 'react'
import FileGrid from '../components/FileGrid'
import FilePreview from '../components/FilePreview'
import ConfirmDialog from '../components/ConfirmDialog'
import useFileManager from '../hooks/useFileManager'
import { listFiles, emptyTrash } from '../services/files'
import { isPreviewable } from '../utils/fileTypes'

export default function Trash() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmEmpty, setConfirmEmpty] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listFiles({ trash: true })
      setFiles(data)
    } catch (err) {
      console.error('Failed to load trash:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const manager = useFileManager({ onRefresh: refresh, isTrashPage: true })

  const handleEmptyTrash = async () => {
    try {
      await emptyTrash()
      setConfirmEmpty(false)
      refresh()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trash</h1>
          <p className="mt-1 text-sm text-gray-500">
            {files.length} file{files.length !== 1 ? 's' : ''} in trash
          </p>
        </div>

        {files.length > 0 && (
          <button
            onClick={() => setConfirmEmpty(true)}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
          >
            Empty Trash
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        </div>
      ) : files.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center text-center">
          <div className="text-6xl">🗑️</div>
          <p className="mt-4 text-lg font-medium text-gray-900">Trash is empty</p>
          <p className="mt-1 text-sm text-gray-500">Deleted files will appear here.</p>
        </div>
      ) : (
        <FileGrid
          files={files}
          onFileOpen={(file) => { if (isPreviewable(file)) manager.setPreviewFile(file); else manager.handlers.handleDownload(file) }}
          onFilePreview={(file) => manager.setPreviewFile(file)}
          onFileDownload={(file) => manager.handlers.handleDownload(file)}
          onFileRestore={(file) => manager.handlers.handleRestore(file)}
          onFileDelete={(file) => manager.setConfirmDelete({ type: 'file', item: file })}
          showFolderColumn={true}
        />
      )}

      {manager.previewFile && (
        <FilePreview
          file={manager.previewFile}
          onClose={() => manager.setPreviewFile(null)}
          onSaved={refresh}
        />
      )}

      {/* Delete confirm */}
      {manager.confirmDelete && (
        <ConfirmDialog
          title="Delete Permanently"
          message={`Permanently delete "${manager.confirmDelete.item.name}"? This also removes it from Telegram. This action cannot be undone.`}
          confirmLabel="Delete Permanently"
          danger
          onConfirm={manager.handlers.handleConfirmDelete}
          onCancel={() => manager.setConfirmDelete(null)}
        />
      )}

      {/* Empty trash confirm */}
      {confirmEmpty && (
        <ConfirmDialog
          title="Empty Trash"
          message={`Permanently delete all ${files.length} file(s) in trash? This also removes them from Telegram. This action cannot be undone.`}
          confirmLabel="Empty Trash"
          danger
          onConfirm={handleEmptyTrash}
          onCancel={() => setConfirmEmpty(false)}
        />
      )}
    </div>
  )
}