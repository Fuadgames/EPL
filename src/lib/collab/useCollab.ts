import { useState, useEffect } from 'react';
import { collabClient } from './collab-client';
import { 
  CollabSessionData, 
  ParticipantPresence, 
  ConnectionStatus, 
  UserRole, 
  ProjectFile 
} from './types';

export function useCollab() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = collabClient.subscribe(() => {
      setTick(t => t + 1);
    });
    return unsub;
  }, []);

  const session = collabClient.session;
  const status: ConnectionStatus = collabClient.status;
  const yourRole: UserRole = collabClient.yourRole;
  const yourColor: string = collabClient.yourColor;
  const currentFileId: string = collabClient.currentFileId;
  const participants: ParticipantPresence[] = collabClient.getAllParticipants();
  const currentFile: ProjectFile | undefined = collabClient.getFile(currentFileId);
  const currentCode: string = collabClient.getCode(currentFileId);
  const otherUsersInFile: ParticipantPresence[] = collabClient.getOtherParticipantsInFile(currentFileId);

  return {
    client: collabClient,
    session,
    status,
    yourRole,
    yourColor,
    currentFileId,
    currentFile,
    currentCode,
    participants,
    otherUsersInFile,
    chatMessages: collabClient.chatMessages,
    errorMessage: collabClient.errorMessage,
    isActive: !!session && status !== 'offline',
    isViewer: yourRole === 'viewer',
    isOwner: yourRole === 'owner',
    updateCode: (code: string) => collabClient.updateCode(currentFileId, code),
    updateCursor: (line: number, ch: number, selection?: any) => 
      collabClient.updateCursor(currentFileId, line, ch, selection),
    switchFile: (fileId: string) => collabClient.switchFile(fileId),
    createFile: (name: string, type?: 'file' | 'folder', parentId?: string | null, content?: string) => 
      collabClient.createFile(name, type, parentId, content),
    deleteFile: (fileId: string) => collabClient.deleteFile(fileId),
    renameFile: (fileId: string, newName: string) => collabClient.renameFile(fileId, newName),
    moveFile: (fileId: string, newParentId: string | null) => collabClient.moveFile(fileId, newParentId),
    updateRole: (targetUid: string, newRole: UserRole) => collabClient.updateRole(targetUid, newRole),
    sendChatMessage: (text: string) => collabClient.sendChatMessage(text),
    saveSession: () => collabClient.save(),
    leaveSession: () => collabClient.leave()
  };
}
