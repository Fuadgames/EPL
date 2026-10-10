import React, { useState } from 'react';
import { useCollab } from '../../lib/collab/useCollab';
import { ProjectFile } from '../../lib/collab/types';
import { useStore } from '../../store/useStore';
import { 
  FileCode, 
  Folder, 
  FolderPlus, 
  FilePlus, 
  Trash2, 
  Edit2, 
  ChevronRight, 
  ChevronDown, 
  Download, 
  MoreVertical,
  X,
  Check
} from 'lucide-react';
import { clsx } from 'clsx';

interface CollabFileTreeProps {
  onDownloadProject?: () => void;
  className?: string;
}

export default function CollabFileTree({ onDownloadProject, className }: CollabFileTreeProps) {
  const {
    session,
    currentFileId,
    participants,
    isViewer,
    switchFile,
    createFile,
    deleteFile,
    renameFile
  } = useCollab();

  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const language = useStore(state => state.language);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [activeParentFolder, setActiveParentFolder] = useState<string | null>(null);

  const files = session?.files || [];

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const handleStartRename = (file: ProjectFile, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isViewer) return;
    setEditingFileId(file.id);
    setRenameInput(file.name);
  };

  const handleConfirmRename = () => {
    if (editingFileId && renameInput.trim()) {
      renameFile(editingFileId, renameInput.trim());
    }
    setEditingFileId(null);
  };

  const handleDelete = (file: ProjectFile, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isViewer) return;
    if (files.filter(f => f.type === 'file').length <= 1) {
      alert("A project must have at least one file.");
      return;
    }
    if (confirm(`Delete ${file.name}?`)) {
      deleteFile(file.id);
    }
  };

  const handleCreateNewItem = (type: 'file' | 'folder') => {
    if (!newFileName.trim()) return;
    let name = newFileName.trim();
    if (type === 'file' && !name.includes('.')) {
      name += '.epl';
    }
    createFile(name, type, activeParentFolder);
    setNewFileName('');
    setShowNewFileInput(false);
    setShowNewFolderInput(false);
  };

  // Find which participants are currently on each file
  const fileParticipantsMap = React.useMemo(() => {
    const map = new Map<string, typeof participants>();
    for (const p of participants) {
      if (p.currentFileId) {
        const list = map.get(p.currentFileId) || [];
        list.push(p);
        map.set(p.currentFileId, list);
      }
    }
    return map;
  }, [participants]);

  // Root files and folders
  const rootItems = files.filter(f => !f.parentId);

  return (
    <div className={clsx(
      "w-60 flex flex-col border-r select-none h-full shrink-0 font-sans text-xs",
      isFrutigerAero ? "bg-white/50 border-white/50 backdrop-blur-md" :
      theme !== 'light' ? "bg-zinc-900 border-zinc-800 text-zinc-300" : "bg-zinc-50 border-zinc-200 text-zinc-800",
      className
    )}>
      {/* Header / Actions */}
      <div className={clsx(
        "p-2.5 px-3 border-b flex items-center justify-between font-medium shrink-0",
        theme !== 'light' ? "border-zinc-800 bg-zinc-900/60" : "border-zinc-200 bg-zinc-100/60"
      )}>
        <span className="font-bold text-[11px] uppercase tracking-wider text-zinc-400">
          {session?.projectName || 'Project Files'}
        </span>

        {!isViewer && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setShowNewFileInput(true);
                setShowNewFolderInput(false);
                setNewFileName('');
              }}
              className="p-1 rounded hover:bg-zinc-700/30 text-zinc-400 hover:text-white transition-colors"
              title="New File"
            >
              <FilePlus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setShowNewFolderInput(true);
                setShowNewFileInput(false);
                setNewFileName('');
              }}
              className="p-1 rounded hover:bg-zinc-700/30 text-zinc-400 hover:text-white transition-colors"
              title="New Folder"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
            {onDownloadProject && (
              <button
                onClick={onDownloadProject}
                className="p-1 rounded hover:bg-zinc-700/30 text-zinc-400 hover:text-white transition-colors"
                title="Download Project"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* New file / folder inline form */}
      {(showNewFileInput || showNewFolderInput) && (
        <div className="p-2 border-b border-zinc-800 bg-zinc-800/40 flex items-center gap-1.5">
          <input
            type="text"
            autoFocus
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateNewItem(showNewFileInput ? 'file' : 'folder');
              if (e.key === 'Escape') {
                setShowNewFileInput(false);
                setShowNewFolderInput(false);
              }
            }}
            placeholder={showNewFileInput ? "filename.epl" : "foldername"}
            className="flex-1 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-white focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => handleCreateNewItem(showNewFileInput ? 'file' : 'folder')}
            className="p-1 rounded bg-blue-600 hover:bg-blue-500 text-white"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setShowNewFileInput(false);
              setShowNewFolderInput(false);
            }}
            className="p-1 rounded hover:bg-zinc-700 text-zinc-400"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Files List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {rootItems.map(item => (
          <FileTreeItem
            key={item.id}
            item={item}
            allFiles={files}
            activeFileId={currentFileId}
            editingFileId={editingFileId}
            renameInput={renameInput}
            setRenameInput={setRenameInput}
            onSelectFile={(id) => switchFile(id)}
            onStartRename={handleStartRename}
            onConfirmRename={handleConfirmRename}
            onDelete={handleDelete}
            expandedFolders={expandedFolders}
            onToggleFolder={toggleFolder}
            fileParticipants={fileParticipantsMap.get(item.id) || []}
            isViewer={isViewer}
          />
        ))}
      </div>
    </div>
  );
}

interface FileTreeItemProps {
  item: ProjectFile;
  allFiles: ProjectFile[];
  activeFileId: string;
  editingFileId: string | null;
  renameInput: string;
  setRenameInput: (v: string) => void;
  onSelectFile: (id: string) => void;
  onStartRename: (item: ProjectFile, e: React.MouseEvent) => void;
  onConfirmRename: () => void;
  onDelete: (item: ProjectFile, e: React.MouseEvent) => void;
  expandedFolders: Set<string>;
  onToggleFolder: (id: string) => void;
  fileParticipants: any[];
  isViewer: boolean;
}

function FileTreeItem({
  item,
  allFiles,
  activeFileId,
  editingFileId,
  renameInput,
  setRenameInput,
  onSelectFile,
  onStartRename,
  onConfirmRename,
  onDelete,
  expandedFolders,
  onToggleFolder,
  fileParticipants,
  isViewer
}: FileTreeItemProps) {
  const isEditing = editingFileId === item.id;
  const isFolder = item.type === 'folder';
  const isExpanded = expandedFolders.has(item.id);
  const isActive = activeFileId === item.id;

  const children = isFolder ? allFiles.filter(f => f.parentId === item.id) : [];

  return (
    <div>
      <div
        onClick={() => {
          if (isFolder) onToggleFolder(item.id);
          else onSelectFile(item.id);
        }}
        className={clsx(
          "group flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-xs",
          isActive && !isFolder
            ? "bg-blue-600/20 text-blue-400 font-medium border border-blue-500/30"
            : "hover:bg-zinc-800/40 text-zinc-300"
        )}
      >
        <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
          {isFolder ? (
            <>
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />}
              <Folder className="w-4 h-4 text-amber-400 shrink-0" />
            </>
          ) : (
            <FileCode className={clsx("w-4 h-4 shrink-0", item.name.endsWith('.epl') ? "text-emerald-400" : "text-zinc-400")} />
          )}

          {isEditing ? (
            <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
              <input
                type="text"
                autoFocus
                value={renameInput}
                onChange={e => setRenameInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') onConfirmRename();
                }}
                className="w-full px-1.5 py-0.5 bg-zinc-950 border border-blue-500 rounded text-xs text-white"
              />
              <button onClick={onConfirmRename} className="p-0.5 text-emerald-400"><Check className="w-3 h-3" /></button>
            </div>
          ) : (
            <span className="truncate">{item.name}</span>
          )}
        </div>

        {/* Live Participants Indicator on this file */}
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {fileParticipants.length > 0 && !isFolder && (
            <div className="flex -space-x-1 items-center" title={fileParticipants.map((p: any) => `${p.name} is on this file`).join(', ')}>
              {fileParticipants.slice(0, 3).map((p: any) => (
                <div
                  key={p.uid}
                  className="w-4 h-4 rounded-full border border-black flex items-center justify-center text-[8px] font-bold text-white shadow-xs"
                  style={{ backgroundColor: p.color }}
                >
                  {p.name.charAt(0).toUpperCase()}
                </div>
              ))}
              {fileParticipants.length > 3 && (
                <div className="w-4 h-4 rounded-full bg-zinc-700 text-[8px] text-zinc-300 flex items-center justify-center font-bold">
                  +{fileParticipants.length - 3}
                </div>
              )}
            </div>
          )}

          {/* Action buttons on hover */}
          {!isViewer && !isEditing && (
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
              <button
                onClick={(e) => onStartRename(item, e)}
                className="p-1 hover:text-white text-zinc-400 rounded"
                title="Rename"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => onDelete(item, e)}
                className="p-1 hover:text-red-400 text-zinc-400 rounded"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Render children for folders */}
      {isFolder && isExpanded && (
        <div className="pl-3.5 border-l border-zinc-800/80 ml-2 mt-0.5 space-y-0.5">
          {children.map(child => (
            <FileTreeItem
              key={child.id}
              item={child}
              allFiles={allFiles}
              activeFileId={activeFileId}
              editingFileId={editingFileId}
              renameInput={renameInput}
              setRenameInput={setRenameInput}
              onSelectFile={onSelectFile}
              onStartRename={onStartRename}
              onConfirmRename={onConfirmRename}
              onDelete={onDelete}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              fileParticipants={[]}
              isViewer={isViewer}
            />
          ))}
        </div>
      )}
    </div>
  );
}
