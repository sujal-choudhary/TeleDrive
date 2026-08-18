import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Squares2X2Icon, ListBulletIcon } from '@heroicons/react/24/outline'
import FileGrid from '../components/FileGrid'
import FileList from '../components/FileList'
import FilePreview from '../components/FilePreview'
import ConfirmDialog from '../components/ConfirmDialog'
import UploadModal from '../components/UploadModal'
import useFileManager from '../hooks/useFileManager'
import { listFiles } from '../services/files'
import { listFolders } from '../services/folders'
import { isPreviewable } from '../utils/fileTypes'

export default function Dashboard() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [folders, setFolders] = useState([])
  const [files, setFiles] = useState([])
  const [view, setView] = useState('grid') // grid | list
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')
  const [showUpload, setShowUpload] = useState(false)
  const [loading, setLoading] = useState(true)

  const search = searchParams.get('search') || ''

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [filesData, foldersData] = await Promise.all([
        listFiles({
          search: search || undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
        }),
        listFolders(),
      ])
      setFiles(filesData)
      setFolders(foldersData)
    } catch (err) {
      console.error('Failed to load dashboard:', err)
    } finally {
      setLoading(false)
    }
  }, [search, sortBy, sortOrder])

  useEffect(() => {
    refresh()
  }, [refresh])

  const manager = useFileManager({ onRefresh: refresh })

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {search ? `Search: "${search}"` : 'My Files'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {folders.length} folders · {files.length} files
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
            <button
              onClick={() => setView('grid')}
              className={`rounded-md p-2 ${view === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400'}`}
            >
              <Squares2X2Icon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`rounded-md p-2 ${view === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400'}`}
            >
              <ListBulletIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        </div>
      ) : folders.length === 0 && files.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center text-center">
          <div className="text-6xl">📁</div>
          <p className="mt-4 text-lg font-medium text-gray-900">No files yet</p>
          <p className="mt-1 text-sm text-gray-500">Create a folder or upload your first file.</p>
          <button
            onClick={() => setShowUpload(true)}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Upload Files
          </button>
        </div>
      ) : view === 'grid' ? (
        <FileGrid
          folders={folders}
          files={files}
          onFolderOpen={(folder) => navigate(`/folder/${folder.id}`)}
          onFileOpen={(file) => { if (isPreviewable(file)) manager.setPreviewFile(file); else manager.handlers.handleDownload(file) }}
          onFilePreview={(file) => manager.setPreviewFile(file)}
          onFileDownload={(file) => manager.handlers.handleDownload(file)}
          onFileRename={(file) => manager.setRenamingFile(file)}
          onFileMove={(file) => manager.setMovingFile(file)}
          onFileTrash={(file) => manager.handlers.handleTrash(file)}
          onFileDelete={(file) => manager.setConfirmDelete({ type: 'file', item: file })}
          onFolderRename={(folder) => manager.setRenamingFolder(folder)}
          onFolderMove={(folder) => manager.setMovingFolder(folder)}
          onFolderDelete={(folder) => manager.setConfirmDelete({ type: 'folder', item: folder })}
          showFolderColumn={false}
        />
      ) : (
        <FileList
          folders={folders}
          files={files}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          onFolderOpen={(folder) => navigate(`/folder/${folder.id}`)}
          onFileOpen={(file) => { if (isPreviewable(file)) manager.setPreviewFile(file); else manager.handlers.handleDownload(file) }}
        />
      )}

      {/* Upload modal */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={refresh}
        />
      )}

      {/* Preview modal */}
      {manager.previewFile && (
        <FilePreview
          file={manager.previewFile}
          onClose={() => manager.setPreviewFile(null)}
          onSaved={refresh}
        />
      )}

      {/* Rename dialog */}
      {(manager.renamingFile || manager.renamingFolder) && (
        <RenameDialog
          currentName={(manager.renamingFile || manager.renamingFolder)?.name}
          onCancel={() => { manager.setRenamingFile(null); manager.setRenamingFolder(null) }}
          onConfirm={manager.handlers.handleRenameSubmit}
        />
      )}

      {/* Move dialog */}
      {(manager.movingFile || manager.movingFolder) && (
        <MoveDialog
          folders={folders}
          onCancel={() => { manager.setMovingFile(null); manager.setMovingFolder(null) }}
          onConfirm={(folderId) => {
            if (manager.movingFile) manager.handlers.handleMoveFile(folderId)
            else manager.handlers.handleMoveFolder(folderId)
          }}
        />
      )}

      {/* Delete confirm */}
      {manager.confirmDelete && (
        <ConfirmDialog
          title={manager.confirmDelete.type === 'folder' ? 'Delete Folder' : 'Delete File'}
          message={
            manager.confirmDelete.type === 'folder'
              ? `Delete "${manager.confirmDelete.item.name}" and all its contents? This will permanently delete files from Telegram.`
              : `Permanently delete "${manager.confirmDelete.item.name}"? This also removes it from Telegram.`
          }
          confirmLabel="Delete"
          danger
          onConfirm={manager.handlers.handleConfirmDelete}
          onCancel={() => manager.setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

function RenameDialog({ currentName, onConfirm, onCancel }) {
  const [name, setName] = useState(currentName || '')

  return (
    <ConfirmDialog
      title="Rename"
      message={
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
          autoFocus
        />
      }
      confirmLabel="Save"
      onConfirm={() => onConfirm(name.trim())}
      onCancel={onCancel}
    />
  )
}

function MoveDialog({ folders, onConfirm, onCancel }) {
  return (
    <ConfirmDialog
      title="Move to folder"
      message={
        <select
          className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
          defaultValue=""
          onChange={(e) => onConfirm(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Root folder</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>{folder.name}</option>
          ))}
        </select>
      }
      confirmLabel="Move"
      onCancel={onCancel}
    />
  )
}