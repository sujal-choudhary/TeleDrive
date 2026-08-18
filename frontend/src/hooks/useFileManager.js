import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { downloadFile, updateFile, deleteFile } from '../services/files'
import { updateFolder, deleteFolder } from '../services/folders'

/**
 * Shared file/folder management logic.
 * Provides handlers for open, download, star, trash, restore, delete, rename, move.
 */
export default function useFileManager({ onRefresh, isTrashPage = false }) {
  const navigate = useNavigate()
  const [previewFile, setPreviewFile] = useState(null)
  const [renamingFile, setRenamingFile] = useState(null)
  const [renamingFolder, setRenamingFolder] = useState(null)
  const [movingFile, setMovingFile] = useState(null)
  const [movingFolder, setMovingFolder] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleDownload = useCallback(async (file) => {
    try {
      const response = await downloadFile(file.id)
      const url = URL.createObjectURL(response.data)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  const handleStar = useCallback(async (file) => {
    try {
      await updateFile(file.id, { is_starred: !file.is_starred })
      onRefresh?.()
    } catch (err) {
      setError(err.message)
    }
  }, [onRefresh])

  const handleTrash = useCallback(async (file) => {
    try {
      await updateFile(file.id, { is_trashed: true })
      onRefresh?.()
    } catch (err) {
      setError(err.message)
    }
  }, [onRefresh])

  const handleRestore = useCallback(async (file) => {
    try {
      await updateFile(file.id, { is_trashed: false })
      onRefresh?.()
    } catch (err) {
      setError(err.message)
    }
  }, [onRefresh])

  const handleRenameSubmit = useCallback(async (newName) => {
    try {
      if (renamingFile) {
        await updateFile(renamingFile.id, { name: newName })
      }
      if (renamingFolder) {
        await updateFolder(renamingFolder.id, { name: newName })
      }
      setRenamingFile(null)
      setRenamingFolder(null)
      onRefresh?.()
    } catch (err) {
      setError(err.message)
    }
  }, [renamingFile, renamingFolder, onRefresh])

  const handleMoveFile = useCallback(async (folderId) => {
    try {
      if (movingFile) {
        await updateFile(movingFile.id, { folder_id: folderId })
      }
      setMovingFile(null)
      onRefresh?.()
    } catch (err) {
      setError(err.message)
    }
  }, [movingFile, onRefresh])

  const handleMoveFolder = useCallback(async (folderId) => {
    try {
      if (movingFolder) {
        await updateFolder(movingFolder.id, { parent_id: folderId })
      }
      setMovingFolder(null)
      onRefresh?.()
    } catch (err) {
      setError(err.message)
    }
  }, [movingFolder, onRefresh])

  const handleConfirmDelete = useCallback(async () => {
    try {
      if (confirmDelete?.type === 'file') {
        await deleteFile(confirmDelete.item.id)
      } else if (confirmDelete?.type === 'folder') {
        await deleteFolder(confirmDelete.item.id, true)
      }
      setConfirmDelete(null)
      onRefresh?.()
    } catch (err) {
      setError(err.message)
    }
  }, [confirmDelete, onRefresh])

  const handleOpenFile = useCallback((file) => {
    if (isTrashPage) return
    navigate(`/folder/${file.folder_id || ''}`)
  }, [navigate, isTrashPage])

  return {
    previewFile,
    setPreviewFile,
    renamingFile,
    setRenamingFile,
    renamingFolder,
    setRenamingFolder,
    movingFile,
    setMovingFile,
    movingFolder,
    setMovingFolder,
    confirmDelete,
    setConfirmDelete,
    confirmEmptyTrash,
    setConfirmEmptyTrash,
    loading,
    setLoading,
    error,
    setError,
    handlers: {
      handleDownload,
      handleStar,
      handleTrash,
      handleRestore,
      handleRenameSubmit,
      handleMoveFile,
      handleMoveFolder,
      handleConfirmDelete,
      handleOpenFile,
    },
  }
}