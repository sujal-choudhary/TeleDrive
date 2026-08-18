import FileCard from './FileCard'
import FolderCard from './FolderCard'

export default function FileGrid({
  folders = [],
  files = [],
  onFolderOpen,
  onFileOpen,
  onFilePreview,
  onFileDownload,
  onFileRename,
  onFileMove,
  onFileTrash,
  onFileDelete,
  onFileRestore,
  onFolderRename,
  onFolderMove,
  onFolderDelete,
  showFolderColumn = true,
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {folders.map((folder) => (
        <FolderCard
          key={folder.id}
          folder={folder}
          onOpen={() => onFolderOpen?.(folder)}
          onRename={onFolderRename ? () => onFolderRename(folder) : null}
          onMove={onFolderMove ? () => onFolderMove(folder) : null}
          onDelete={onFolderDelete ? () => onFolderDelete(folder) : null}
        />
      ))}

      {files.map((file) => (
        <FileCard
          key={file.id}
          file={file}
          showFolder={showFolderColumn}
          onOpen={() => onFileOpen?.(file)}
          onPreview={() => onFilePreview?.(file)}
          onDownload={() => onFileDownload?.(file)}
          onRename={onFileRename ? () => onFileRename(file) : null}
          onMove={onFileMove ? () => onFileMove(file) : null}
          onTrash={onFileTrash ? () => onFileTrash(file) : null}
          onDelete={onFileDelete ? () => onFileDelete(file) : null}
          onRestore={onFileRestore ? () => onFileRestore(file) : null}
        />
      ))}
    </div>
  )
}