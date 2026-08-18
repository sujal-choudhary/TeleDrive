import { useState } from 'react'
import { FolderIcon } from '@heroicons/react/24/outline'
import { formatFileSize, formatDate, getFileConfig } from '../utils/fileTypes'

export default function FileList({
  folders = [],
  files = [],
  sortBy = 'name',
  sortOrder = 'asc',
  onSort,
  onFolderOpen,
  onFileOpen,
}) {
  const [selectedId, setSelectedId] = useState(null)

  const SortHeader = ({ label, field }) => (
    <th
      className="cursor-pointer px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700"
      onClick={() => onSort?.(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        {sortBy === field && (
          <span className="text-blue-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>
        )}
      </span>
    </th>
  )

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            <SortHeader label="Name" field="name" />
            <SortHeader label="Size" field="size" />
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Type
            </th>
            <SortHeader label="Modified" field="updated_at" />
            <SortHeader label="Created" field="created_at" />
          </tr>
        </thead>
        <tbody>
          {folders.map((folder) => (
            <tr
              key={`folder-${folder.id}`}
              className="cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50"
              onClick={() => onFolderOpen?.(folder)}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <FolderIcon className="h-5 w-5 text-yellow-500" />
                  <span className="font-medium text-gray-900">{folder.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-500">—</td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                  Folder
                </span>
              </td>
              <td className="px-4 py-3 text-gray-500">{formatDate(folder.updated_at)}</td>
              <td className="px-4 py-3 text-gray-500">{formatDate(folder.created_at)}</td>
            </tr>
          ))}

          {files.map((file) => {
            const config = getFileConfig(file)
            return (
              <tr
                key={`file-${file.id}`}
                className={`cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50 ${
                  selectedId === file.id ? 'bg-blue-50' : ''
                }`}
                onClick={() => {
                  setSelectedId(file.id)
                  onFileOpen?.(file)
                }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-base ${config.color}`}>
                      {config.icon}
                    </span>
                    <span className="font-medium text-gray-900">{file.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{formatFileSize(file.file_size)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${config.color}`}>
                    {config.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{formatDate(file.updated_at)}</td>
                <td className="px-4 py-3 text-gray-500">{formatDate(file.created_at)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}