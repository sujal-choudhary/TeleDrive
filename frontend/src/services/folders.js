import api from './api'

/**
 * List folders, optionally filtered by parent.
 * @param {number|null} parentId
 */
export async function listFolders(parentId = null) {
  const params = {}
  if (parentId != null) params.parent = parentId
  const res = await api.get('/folders', { params })
  return res.data.folders
}

/**
 * Create a folder.
 * @param {string} name
 * @param {number|null} parentId
 */
export async function createFolder(name, parentId = null) {
  const res = await api.post('/folders', { name, parent_id: parentId })
  return res.data.folder
}

/**
 * Get a folder with contents and breadcrumbs.
 */
export async function getFolder(id) {
  const res = await api.get(`/folders/${id}`)
  return res.data
}

/**
 * Update folder (rename or move).
 * @param {number} id
 * @param {Object} data - { name, parent_id }
 */
export async function updateFolder(id, data) {
  const res = await api.patch(`/folders/${id}`, data)
  return res.data.folder
}

/**
 * Delete a folder.
 * @param {number} id
 * @param {boolean} deleteContents
 */
export async function deleteFolder(id, deleteContents = false) {
  const res = await api.delete(`/folders/${id}`, { data: { delete_contents: deleteContents } })
  return res.data
}