import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronRightIcon, ArrowUpTrayIcon, FolderPlusIcon, Squares2X2Icon, ListBulletIcon } from '@heroicons/react/24/outline'
import FileGrid from '../components/FileGrid'
import FileList from '../components/FileList'
import FilePreview from '../components/FilePreview'
import ConfirmDialog from '../components/ConfirmDialog'
import UploadModal from '../components/UploadModal'
import useFileManager from '../hooks/useFileManager'
import { getFolder, createFolder } from '../services/folders'
import { isPreviewable } from '../utils/fileTypes'

export default function Folder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [folder, setFolder] = useState(null)
  const [breadcrumbs, setBreadcrumbs] = useState([])
  const [folders, setFolders] = useState([])
  const [files, setFiles] = useState([])
  const [view, setView] = useState('grid')
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')
  const [showUpload, setShowUpload] = useState(false)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getFolder(id)
      setFolder(data.folder)
      setBreadcrumbs(data.breadcrumbs || [])
      setFolders(data.subfolders || [])
      setFiles(data.files || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [id])

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

  const handleCreateFolder = async (e) => {
    e.preventDefault()
    if (!newFolderName.trim()) return
    try {
      await createFolder(newFolderName.trim(), Number(id))
      setNewFolderName('')
      setShowNewFolder(false)
      refresh()
    } catch (err) {
      alert(err.message)
    }
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="text-5xl">🔍</div>
        <p className="mt-4 text-lg font-medium text-gray-900">Folder not found</p>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <Link
          to="/"
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Back to My Files
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Breadcrumbs */}
      <nav className="mb-6 flex items-center gap-1 text-sm text-gray-600">
        <Link to="/" className="font-medium text-gray-900 hover:text-blue-600">
          My Files
        </Link>
        {breadcrumbs.map((crumb) => (
          <span key={crumb.id} className="flex items-center gap-1">
            <ChevronRightIcon className="h-4 w-4 text-gray-400" />
            <Link to={`/folder/${crumb.id}`} className="text-gray-600 hover:text-blue-600">
              {crumb.name}
            </Link>
          </span>
        ))}
        {folder && (
          <>
            <ChevronRightIcon className="h-4 w-4 text-gray-400" />
            <span className="font-medium text-gray-900">{folder.name}</span>
          </>
        )}
      </nav>

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{folder?.name || 'Folder'}</h1>
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

          <button
            onClick={() => setShowNewFolder(true)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <FolderPlusIcon className="h-5 w-5" />
            New Folder
          </button>

          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <ArrowUpTrayIcon className="h-5 w-5" />
            Upload
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        </div>
      ) : folders.length === 0 && files.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center text-center">
          <div className="text-6xl">📂</div>
          <p className="mt-4 text-lg font-medium text-gray-900">This folder is empty</p>
          <p className="mt-1 text-sm text-gray-500">Upload files or create subfolders.</p>
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
          onFolderRename={(child) => manager.setRenamingFolder(child)}
          onFolderMove={(child) => manager.setMovingFolder(child)}
          onFolderDelete={(child) => manager.setConfirmDelete({ type: 'folder', item: child })}
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

      {/* New folder inline form */}
      {showNewFolder && (
        <form
          onSubmit={handleCreateFolder}
          className="mb-4 flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 p-3"
        >
          <input
            autoFocus
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onBlur={() => setTimeout(() => setShowNewFolder(false), 200)}
            placeholder="Folder name"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setShowNewFolder(false)}
            className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Upload modal */}
      {showUpload && (
        <UploadModal
          folderId={Number(id)}
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
              ? `Delete "${manager.confirmDelete.item.name}" and all its contents?`
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