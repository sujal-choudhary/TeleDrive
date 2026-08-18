import { useState, useRef, useCallback } from 'react'
import { XMarkIcon, ArrowUpTrayIcon, FolderIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { uploadFiles } from '../services/files'

export default function UploadModal({ onClose, folderId = null, onUploaded }) {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)
  const folderInputRef = useRef(null)

  const addFiles = useCallback((fileList, basePath = '') => {
    const newFiles = Array.from(fileList).map((file) => {
      // For folder uploads, compute the relative path
      let relativePath = ''
      if (basePath) {
        relativePath = basePath
      } else if (file.webkitRelativePath) {
        // Extract the folder path (everything before the filename)
        const parts = file.webkitRelativePath.split('/')
        if (parts.length > 1) {
          relativePath = parts.slice(0, -1).join('/')
        }
      }

      return {
        file,
        relativePath,
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        progress: 0,
        status: 'pending', // pending | uploading | done | error
        error: null,
      }
    })
    setFiles((prev) => [...prev, ...newFiles])
  }, [])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    addFiles(e.dataTransfer.files)
  }

  const handleUpload = async () => {
    if (files.length === 0 || uploading) return

    setUploading(true)

    // Upload files one at a time for progress tracking
    for (let i = 0; i < files.length; i++) {
      const item = files[i]

      setFiles((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, status: 'uploading' } : f))
      )

      try {
        const paths = item.relativePath ? [item.relativePath] : null
        const uploaded = await uploadFiles([item.file], folderId, (event) => {
          if (event.total) {
            const percent = Math.round((event.loaded / event.total) * 100)
            setFiles((prev) =>
              prev.map((f) => (f.id === item.id ? { ...f, progress: percent } : f))
            )
          }
        }, paths)

        setFiles((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, status: 'done', progress: 100 } : f))
        )

        if (onUploaded) {
          onUploaded(uploaded)
        }
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, status: 'error', error: err.message } : f
          )
        )
      }
    }

    setUploading(false)
  }

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const retryFile = (id) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: 'pending', progress: 0, error: null } : f))
    )
  }

  const allDone = files.length > 0 && files.every((f) => f.status === 'done')
  const hasErrors = files.some((f) => f.status === 'error')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Upload Files</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            }`}
          >
            <ArrowUpTrayIcon className="h-10 w-10 text-gray-400" />
            <p className="mt-3 text-sm text-gray-600">
              Drag files or folders here or
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Select Files
              </button>
              <button
                onClick={() => folderInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <FolderIcon className="h-4 w-4" />
                Select Folder
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              webkitdirectory=""
              directory=""
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="mt-4 max-h-60 space-y-2 overflow-y-auto">
              {files.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {item.relativePath ? `${item.relativePath}/${item.file.name}` : item.file.name}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      {item.status === 'uploading' && (
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full bg-blue-600 transition-all"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      )}
                      {item.status === 'pending' && (
                        <span className="text-xs text-gray-500">Ready to upload</span>
                      )}
                      {item.status === 'done' && (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircleIcon className="h-4 w-4" /> Uploaded
                        </span>
                      )}
                      {item.status === 'error' && (
                        <span className="flex items-center gap-1 text-xs text-red-600">
                          <XCircleIcon className="h-4 w-4" /> {item.error || 'Upload failed'}
                        </span>
                      )}
                      {item.status === 'uploading' && (
                        <span className="text-xs text-gray-500">{item.progress}%</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {item.status === 'error' && (
                      <button
                        onClick={() => retryFile(item.id)}
                        className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                      >
                        Retry
                      </button>
                    )}
                    {item.status !== 'uploading' && (
                      <button
                        onClick={() => removeFile(item.id)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-3">
            {hasErrors && (
              <button
                onClick={() => setFiles((prev) => prev.filter((f) => f.status !== 'done'))}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear completed
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              {allDone ? 'Close' : 'Cancel'}
            </button>
            {!allDone && (
              <button
                onClick={handleUpload}
                disabled={files.length === 0 || uploading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}