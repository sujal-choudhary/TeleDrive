import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import FileGrid from '../components/FileGrid'
import FilePreview from '../components/FilePreview'
import useFileManager from '../hooks/useFileManager'
import { listFiles } from '../services/files'
import { isPreviewable } from '../utils/fileTypes'

export default function Starred() {
  const navigate = useNavigate()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listFiles({ starred: true })
      setFiles(data)
    } catch (err) {
      console.error('Failed to load starred files:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const manager = useFileManager({ onRefresh: refresh })

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Starred</h1>
        <p className="mt-1 text-sm text-gray-500">
          Files you've starred for quick access
        </p>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        </div>
      ) : files.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center text-center">
          <div className="text-6xl">⭐</div>
          <p className="mt-4 text-lg font-medium text-gray-900">No starred files</p>
          <p className="mt-1 text-sm text-gray-500">Star your important files to find them here quickly.</p>
        </div>
      ) : (
        <FileGrid
          files={files}
          onFolderOpen={(folder) => navigate(`/folder/${folder.id}`)}
          onFileOpen={(file) => { if (isPreviewable(file)) manager.setPreviewFile(file); else manager.handlers.handleDownload(file) }}
          onFilePreview={(file) => manager.setPreviewFile(file)}
          onFileDownload={(file) => manager.handlers.handleDownload(file)}
          onFileRename={(file) => manager.setRenamingFile(file)}
          onFileMove={(file) => manager.setMovingFile(file)}
          onFileTrash={(file) => manager.handlers.handleTrash(file)}
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
    </div>
  )
}