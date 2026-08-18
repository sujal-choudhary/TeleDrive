import api from './api'

/**
 * List files with filters and sorting.
 * @param {Object} params - { folder, search, starred, trash, type, sort_by, sort_order }
 */
export async function listFiles(params = {}) {
  const res = await api.get('/files', { params })
  return res.data.files
}

/**
 * Get a single file by ID.
 */
export async function getFile(id) {
  const res = await api.get(`/files/${id}`)
  return res.data.file
}

/**
 * Upload files (multipart/form-data).
 * @param {File[]} files - Array of File objects
 * @param {number|null} folderId - Target folder
 * @param {Function} onProgress - (progressEvent) => void
 */
export async function uploadFiles(files, folderId = null, onProgress = null) {
  const formData = new FormData()
  files.forEach((file) => formData.append('file', file))
  if (folderId != null) {
    formData.append('folder_id', String(folderId))
  }

  const res = await api.post('/files/upload', formData, {
    onUploadProgress: onProgress || undefined,
  })
  return res.data.files
}

/**
 * Download a file.
 * @param {number} id
 */
export async function downloadFile(id) {
  const response = await api.get(`/files/${id}/download`, {
    responseType: 'blob',
  })
  return response
}

/**
 * Get file content as text (for text/code files).
 * @param {number} id
 */
export async function getFileContent(id) {
  const res = await api.get(`/files/${id}/content`)
  return res.data.content
}

/**
 * Save text content back to a file.
 * @param {number} id
 * @param {string} content
 */
export async function saveFileContent(id, content) {
  const res = await api.put(`/files/${id}/content`, { content })
  return res.data.file
}

/**
 * Update file metadata.
 * @param {number} id
 * @param {Object} data - { name, folder_id, is_starred, is_trashed }
 */
export async function updateFile(id, data) {
  const res = await api.patch(`/files/${id}`, data)
  return res.data.file
}

/**
 * Permanently delete a file.
 */
export async function deleteFile(id) {
  const res = await api.delete(`/files/${id}`)
  return res.data
}

/**
 * Empty trash.
 */
export async function emptyTrash() {
  const res = await api.post('/trash/empty')
  return res.data
}

/**
 * Trigger Telegram sync.
 */
export async function triggerTelegramSync() {
  const res = await api.post('/telegram/sync')
  return res.data
}