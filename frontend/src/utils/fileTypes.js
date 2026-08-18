/**
 * File type detection and icon/color helpers.
 */

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'log', 'csv', 'json', 'js', 'ts', 'jsx', 'tsx', 'py', 'java',
  'css', 'scss', 'html', 'htm', 'xml', 'svg', 'c', 'cpp', 'h', 'hpp', 'go',
  'rs', 'rb', 'php', 'sh', 'bat', 'yaml', 'yml', 'ini', 'cfg', 'conf', 'env',
  'gitignore', 'dockerfile', 'sql', 'toml', 'vue', 'svelte',
])

const TYPE_CONFIG = {
  image: {
    icon: '🖼',
    color: 'bg-green-100 text-green-700',
    label: 'Image',
    previewable: true,
    editable: false,
  },
  video: {
    icon: '🎬',
    color: 'bg-purple-100 text-purple-700',
    label: 'Video',
    previewable: true,
    editable: false,
  },
  audio: {
    icon: '🎵',
    color: 'bg-pink-100 text-pink-700',
    label: 'Audio',
    previewable: false,
    editable: false,
  },
  pdf: {
    icon: '📄',
    color: 'bg-red-100 text-red-700',
    label: 'PDF',
    previewable: true,
    editable: false,
  },
  document: {
    icon: '📝',
    color: 'bg-blue-100 text-blue-700',
    label: 'Document',
    previewable: true,
    editable: true,
  },
  spreadsheet: {
    icon: '📊',
    color: 'bg-green-100 text-green-700',
    label: 'Spreadsheet',
    previewable: true,
    editable: true,
  },
  presentation: {
    icon: '📽',
    color: 'bg-orange-100 text-orange-700',
    label: 'Presentation',
    previewable: false,
    editable: false,
  },
  archive: {
    icon: '📦',
    color: 'bg-yellow-100 text-yellow-700',
    label: 'Archive',
    previewable: false,
    editable: false,
  },
  code: {
    icon: '💻',
    color: 'bg-indigo-100 text-indigo-700',
    label: 'Code',
    previewable: true,
    editable: true,
  },
  text: {
    icon: '📃',
    color: 'bg-gray-100 text-gray-700',
    label: 'Text',
    previewable: true,
    editable: true,
  },
  default: {
    icon: '📎',
    color: 'bg-gray-100 text-gray-700',
    label: 'File',
    previewable: false,
    editable: false,
  },
}

export function getFileType(file) {
  const mimeType = file.mime_type || ''
  const ext = (file.extension || '').toLowerCase()

  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'

  if (mimeType === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (['doc', 'docx', 'txt', 'text/plain'].includes(ext) || mimeType.startsWith('text/')) return 'document'
  if (['xls', 'xlsx'].includes(ext) || mimeType.includes('spreadsheet')) return 'spreadsheet'
  if (['ppt', 'pptx'].includes(ext) || mimeType.includes('presentation')) return 'presentation'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mimeType.startsWith('application/zip') || mimeType.includes('compressed')) return 'archive'
  if (['js', 'ts', 'py', 'java', 'json', 'css', 'html', 'xml', 'c', 'cpp', 'go', 'rs'].includes(ext)) return 'code'
  if (['txt', 'md', 'log', 'csv'].includes(ext)) return 'text'

  return 'default'
}

export function getFileConfig(file) {
  return TYPE_CONFIG[getFileType(file)] || TYPE_CONFIG.default
}

export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function isPreviewable(file) {
  return TYPE_CONFIG[getFileType(file)]?.previewable || false
}

export function isTextEditable(file) {
  const type = getFileType(file)
  if (TYPE_CONFIG[type]?.editable) return true
  const ext = (file.extension || file.name?.split('.').pop() || '').toLowerCase()
  return TEXT_EXTENSIONS.has(ext)
}

export function getTextEditorLanguage(file) {
  const ext = (file.extension || file.name?.split('.').pop() || '').toLowerCase()
  const langMap = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    py: 'python', rb: 'ruby', java: 'java', c: 'c', cpp: 'cpp', h: 'c',
    hpp: 'cpp', go: 'go', rs: 'rust', php: 'php', sh: 'bash', bat: 'batch',
    yaml: 'yaml', yml: 'yaml', json: 'json', xml: 'xml', html: 'html',
    htm: 'html', css: 'css', scss: 'scss', sql: 'sql', md: 'markdown',
    csv: 'csv', ini: 'ini', toml: 'toml', vue: 'vue', svelte: 'svelte',
    dockerfile: 'dockerfile', svg: 'xml',
  }
  return langMap[ext] || 'plaintext'
}
