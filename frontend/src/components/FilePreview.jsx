import { useEffect, useState, useRef, useCallback } from 'react'
import { XMarkIcon, ArrowDownTrayIcon, CheckIcon, PencilIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { getFileType, formatFileSize, formatDate, getFileConfig, isTextEditable, getTextEditorLanguage } from '../utils/fileTypes'
import { downloadFile, getFileContent, saveFileContent } from '../services/files'

export default function FilePreview({ file, onClose, onSaved }) {
  const [blobUrl, setBlobUrl] = useState(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [lineCount, setLineCount] = useState(0)
  const textareaRef = useRef(null)

  const fileType = getFileType(file)
  const config = getFileConfig(file)
  const isText = isTextEditable(file)
  const editorLang = getTextEditorLanguage(file)

  // Load the file - use fast text endpoint for text files, blob for others
  useEffect(() => {
    let cancelled = false

    const loadPreview = async () => {
      setLoading(true)
      setError(null)
      setEditing(false)
      setSaved(false)

      try {
        if (isText) {
          // Fast loading: fetch text content directly
          const text = await getFileContent(file.id)
          if (cancelled) return
          setContent(text)
          setLineCount(text.split('\n').length)
        } else {
          const response = await downloadFile(file.id)
          const blob = response.data
          if (cancelled) return
          const url = URL.createObjectURL(blob)
          setBlobUrl(url)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadPreview()

    return () => {
      cancelled = true
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id, isText])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      // Save content back to the file
      await saveFileContent(file.id, content)
      setSaved(true)
      setEditing(false)
      setTimeout(() => setSaved(false), 2000)
      onSaved?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }, [file.id, content, onSaved])

  const handleEdit = () => {
    setEditing(true)
    setSaved(false)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const handleKeyDown = (e) => {
    // Tab key inserts spaces
    if (e.key === 'Tab') {
      e.preventDefault()
      const start = e.target.selectionStart
      const end = e.target.selectionEnd
      const newContent = content.substring(0, start) + '  ' + content.substring(end)
      setContent(newContent)
      setTimeout(() => {
        e.target.selectionStart = e.target.selectionEnd = start + 2
      }, 0)
    }
    // Ctrl+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      handleSave()
    }
  }

  const handleDownload = async () => {
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
      alert(err.message)
    }
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex h-96 flex-col items-center justify-center text-gray-400">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
          <p className="mt-4 text-sm">Loading preview...</p>
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex h-96 flex-col items-center justify-center text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={handleDownload}
            className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            Download instead
          </button>
        </div>
      )
    }

    // Text editor for text/code files
    if (isText) {
      return (
        <div className="flex h-96 flex-col overflow-hidden rounded-lg border border-gray-200">
          {/* Editor toolbar */}
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2">
            <div className="flex items-center gap-2">
              <DocumentTextIcon className="h-4 w-4 text-gray-500" />
              <span className="text-xs font-medium text-gray-600">
                {editorLang} · {lineCount} lines
              </span>
            </div>
            <div className="flex items-center gap-2">
              {saved && (
                <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                  <CheckIcon className="h-4 w-4" />
                  Saved
                </span>
              )}
              {!editing ? (
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <PencilIcon className="h-3.5 w-3.5" />
                  Edit
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckIcon className="h-3.5 w-3.5" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              )}
            </div>
          </div>

          {/* Editor area */}
          {editing ? (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                setLineCount(e.target.value.split('\n').length)
              }}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              className="flex-1 resize-none bg-white p-4 font-mono text-sm leading-relaxed text-gray-800 outline-none"
              placeholder="Start typing..."
            />
          ) : (
            <pre className="flex-1 overflow-auto bg-white p-4 font-mono text-sm leading-relaxed text-gray-800">
              {content || <span className="text-gray-400">Empty file</span>}
            </pre>
          )}

          {/* Status bar */}
          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-1.5">
            <span className="text-xs text-gray-500">
              {formatFileSize(file.file_size)} · {config.label}
            </span>
            <span className="text-xs text-gray-400">
              {editing ? 'Ctrl+S to save' : 'Click Edit to modify'}
            </span>
          </div>
        </div>
      )
    }

    if (!blobUrl) return null

    switch (fileType) {
      case 'image':
        return (
          <div className="flex h-96 items-center justify-center overflow-auto">
            <img src={blobUrl} alt={file.name} className="max-h-full max-w-full object-contain" />
          </div>
        )
      case 'video':
        return (
          <video src={blobUrl} controls className="mx-auto max-h-96 w-full" />
        )
      case 'pdf':
        return (
          <iframe
            src={blobUrl}
            title={file.name}
            className="h-96 w-full rounded-lg border border-gray-200"
          />
        )
      default:
        return (
          <div className="flex h-96 flex-col items-center justify-center text-center">
            <div className={`flex h-20 w-20 items-center justify-center rounded-2xl text-4xl ${config.color}`}>
              {config.icon}
            </div>
            <p className="mt-4 text-sm font-medium text-gray-900">{file.name}</p>
            <p className="mt-1 text-xs text-gray-500">
              {config.label} · {formatFileSize(file.file_size)}
            </p>
            <button
              onClick={handleDownload}
              className="mt-6 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              Download
            </button>
          </div>
        )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-gray-900">{file.name}</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {formatFileSize(file.file_size)} · {file.mime_type || 'Unknown type'} ·{' '}
              {formatDate(file.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              title="Download"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
            </button>
            <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6">{renderContent()}</div>
      </div>
    </div>
  )
}