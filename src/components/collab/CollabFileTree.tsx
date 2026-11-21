import React, { useState } from 'react';
import { useCollab } from '../../lib/collab/useCollab';
import { ProjectFile } from '../../lib/collab/types';
import { useStore } from '../../store/useStore';
import { notify, confirmAction } from '../../store/useDialogStore';
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
  X,
  Check,
} from 'lucide-react';
import { clsx } from 'clsx';

interface CollabFileTreeProps {
  onDownloadProject?: () => void;
  className?: string;
}

export default function CollabFileTree({ onDownloadProject, className }: CollabFileTreeProps) {
  const { session, currentFileId, participants, isViewer, switchFile, createFile, deleteFile, renameFile } =
    useCollab();

  const theme = useStore(state => state.theme);
  const isFrutigerAero = useStore(state => state.isFrutigerAero);
  const language = useStore(state => state.language);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [activeParentFolder] = useState<string | null>(null);

  const files = session?.files || [];
  const isDark = theme !== 'light' && !isFrutigerAero;

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

  const handleDelete = async (file: ProjectFile, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isViewer) return;
    if (files.filter(f => f.type === 'file').length <= 1) {
      notify.error(language === 'ru' ? 'В проекте должен быть хотя бы один файл.' : 'A project must have at least one file.');
      return;
    }
    const ok = await confirmAction({
      title: language === 'ru' ? 'Удалить файл' : 'Delete File',
      message: language === 'ru' ? `Удалить ${file.name}?` : `Delete ${file.name}?`,
      tone: 'danger',
    });
    if (ok) {
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

  const rootItems = files.filter(f => !f.parentId);

  return (
    <div
      className={clsx(
        'w-60 flex flex-col border-r select-none h-full shrink-0 font-sans text-xs',
        isFrutigerAero
          ? 'frutiger-aero-glass border-white/50 text-blue-950'
          : isDark
          ? 'bg-[#14171B] border-[#262B33] text-[#D1D5DB]'
          : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315]',
        className
      )}
    >
      <div
        className={clsx(
          'p-2.5 px-3 border-b flex items-center justify-between font-medium shrink-0',
          isDark ? 'border-[#262B33] bg-[#181B20]' : 'border-[#E2E5EA] bg-white'
        )}
      >
        <span className="font-semibold text-[11px] uppercase tracking-wider text-[#9BA1A6] truncate">
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
              className={clsx(
                'p-1 rounded transition-colors',
                isDark ? 'hover:bg-[#21252C] text-[#9BA1A6] hover:text-[#F1F3F5]' : 'hover:bg-[#EBEEF2] text-[#5C636E]'
              )}
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
              className={clsx(
                'p-1 rounded transition-colors',
                isDark ? 'hover:bg-[#21252C] text-[#9BA1A6] hover:text-[#F1F3F5]' : 'hover:bg-[#EBEEF2] text-[#5C636E]'
              )}
              title="New Folder"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
            {onDownloadProject && (
              <button
                onClick={onDownloadProject}
                className={clsx(
                  'p-1 rounded transition-colors',
                  isDark ? 'hover:bg-[#21252C] text-[#9BA1A6] hover:text-[#F1F3F5]' : 'hover:bg-[#EBEEF2] text-[#5C636E]'
                )}
                title="Download Project"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {(showNewFileInput || showNewFolderInput) && (
        <div
          className={clsx(
            'p-2 border-b flex items-center gap-1.5',
            isDark ? 'border-[#262B33] bg-[#181B20]' : 'border-[#E2E5EA] bg-white'
          )}
        >
          <input
            type="text"
            autoFocus
            value={newFileName}
            onChange={e => setNewFileName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreateNewItem(showNewFileInput ? 'file' : 'folder');
              if (e.key === 'Escape') {
                setShowNewFileInput(false);
                setShowNewFolderInput(false);
              }
            }}
            placeholder={showNewFileInput ? 'filename.epl' : 'foldername'}
            className={clsx(
              'flex-1 px-2 py-1 border rounded text-xs focus:outline-none focus:border-[#10B981]',
              isDark ? 'bg-[#111315] border-[#262B33] text-[#F1F3F5]' : 'bg-[#F5F6F8] border-[#E2E5EA] text-[#111315]'
            )}
          />
          <button
            onClick={() => handleCreateNewItem(showNewFileInput ? 'file' : 'folder')}
            className="p-1 rounded bg-[#10B981] hover:bg-[#059669] text-[#111315]"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setShowNewFileInput(false);
              setShowNewFolderInput(false);
            }}
            className="p-1 rounded hover:bg-[#21252C] text-[#9BA1A6]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
            onSelectFile={id => switchFile(id)}
            onStartRename={handleStartRename}
            onConfirmRename={handleConfirmRename}
            onDelete={handleDelete}
            expandedFolders={expandedFolders}
            onToggleFolder={toggleFolder}
            fileParticipants={fileParticipantsMap.get(item.id) || []}
            isViewer={isViewer}
            isDark={isDark}
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
  isDark: boolean;
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
  isViewer,
  isDark,
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
          'group flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-colors text-xs',
          isActive && !isFolder
            ? 'bg-[#10B981]/15 text-[#10B981] font-medium border border-[#10B981]/30'
            : isDark
            ? 'hover:bg-[#21252C] text-[#D1D5DB]'
            : 'hover:bg-[#EBEEF2] text-[#111315]'
        )}
      >
        <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
          {isFolder ? (
            <>
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#9BA1A6]" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[#9BA1A6]" />
              )}
              <Folder className="w-4 h-4 text-amber-400 shrink-0" />
            </>
          ) : (
            <FileCode className={clsx('w-4 h-4 shrink-0', item.name.endsWith('.epl') ? 'text-[#10B981]' : 'text-[#9BA1A6]')} />
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
                className={clsx(
                  'w-full px-1.5 py-0.5 border border-[#10B981] rounded text-xs',
                  isDark ? 'bg-[#111315] text-[#F1F3F5]' : 'bg-white text-[#111315]'
                )}
              />
              <button onClick={onConfirmRename} className="p-0.5 text-[#10B981]">
                <Check className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <span className="truncate">{item.name}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {fileParticipants.length > 0 && !isFolder && (
            <div
              className="flex -space-x-1 items-center"
              title={fileParticipants.map((p: any) => `${p.name} is on this file`).join(', ')}
            >
              {fileParticipants.slice(0, 3).map((p: any) => (
                <div
                  key={p.uid}
                  className="w-4 h-4 rounded-full border border-black flex items-center justify-center text-[8px] font-bold text-white"
                  style={{ backgroundColor: p.color }}
                >
                  {p.name.charAt(0).toUpperCase()}
                </div>
              ))}
              {fileParticipants.length > 3 && (
                <div className="w-4 h-4 rounded-full bg-[#262B33] text-[8px] text-[#D1D5DB] flex items-center justify-center font-bold">
                  +{fileParticipants.length - 3}
                </div>
              )}
            </div>
          )}

          {!isViewer && !isEditing && (
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
              <button
                onClick={e => onStartRename(item, e)}
                className="p-1 hover:text-[#10B981] text-[#9BA1A6] rounded"
                title="Rename"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                onClick={e => onDelete(item, e)}
                className="p-1 hover:text-red-500 text-[#9BA1A6] rounded"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {isFolder && isExpanded && (
        <div className={clsx('pl-3.5 border-l ml-2 mt-0.5 space-y-0.5', isDark ? 'border-[#262B33]' : 'border-[#E2E5EA]')}>
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
              isDark={isDark}
            />
          ))}
        </div>
      )}
    </div>
  );
}
