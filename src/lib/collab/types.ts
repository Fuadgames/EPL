export type UserRole = 'owner' | 'editor' | 'viewer';
export type ConnectionStatus = 'connected' | 'reconnecting' | 'offline';

export interface ProjectFile {
  id: string;
  name: string;
  path: string; // e.g. "main.epl", "assets/sprite.png"
  content: string;
  type: 'file' | 'folder';
  parentId?: string | null;
  updatedAt?: number;
}

export interface CursorPosition {
  line: number;
  ch: number;
  selection?: {
    startLine: number;
    startCh: number;
    endLine: number;
    endCh: number;
  } | null;
}

export interface ParticipantPresence {
  uid: string;
  name: string;
  avatarUrl?: string;
  color: string;
  role: UserRole;
  currentFileId: string;
  cursor: CursorPosition | null;
  isTyping: boolean;
  lastActive: number;
}

export interface CollabChatMessage {
  id: string;
  uid: string;
  name: string;
  avatarUrl?: string;
  text: string;
  timestamp: number;
}

export interface CollabSessionData {
  id: string; // 6-char code e.g. "ABC123"
  projectId?: string;
  projectName: string;
  ownerId: string;
  ownerName: string;
  createdAt: number;
  updatedAt: number;
  files: ProjectFile[];
  roles: Record<string, UserRole>; // uid -> role
  allowOfflineAccess?: boolean;
}

// Client to Server Messages
export type ClientMessage =
  | { type: 'join'; sessionId: string; user: { uid: string; name: string; avatarUrl?: string } }
  | { type: 'leave'; sessionId: string }
  | { type: 'cursor'; sessionId: string; fileId: string; line: number; ch: number; selection?: CursorPosition['selection']; isTyping: boolean }
  | { type: 'file:switch'; sessionId: string; fileId: string }
  | { type: 'yjs:update'; sessionId: string; fileId: string; update: string } // base64 encoded Uint8Array
  | { type: 'yjs:sync-step-1'; sessionId: string; fileId: string; stateVector: string }
  | { type: 'file:create'; sessionId: string; file: ProjectFile }
  | { type: 'file:delete'; sessionId: string; fileId: string }
  | { type: 'file:rename'; sessionId: string; fileId: string; newName: string }
  | { type: 'file:move'; sessionId: string; fileId: string; newParentId: string | null }
  | { type: 'role:update'; sessionId: string; targetUid: string; newRole: UserRole }
  | { type: 'chat:message'; sessionId: string; text: string }
  | { type: 'session:save'; sessionId: string }
  | { type: 'session:close'; sessionId: string }
  | { type: 'ping' };

// Server to Client Messages
export type ServerMessage =
  | { 
      type: 'session:init'; 
      session: CollabSessionData; 
      yourRole: UserRole; 
      yourColor: string; 
      participants: ParticipantPresence[] 
    }
  | { type: 'session:error'; error: string; code?: string }
  | { type: 'participant:joined'; participant: ParticipantPresence }
  | { type: 'participant:left'; uid: string }
  | { type: 'presence:update'; participants: ParticipantPresence[] }
  | { type: 'cursor:update'; uid: string; fileId: string; cursor: CursorPosition | null; isTyping: boolean }
  | { type: 'yjs:update'; fileId: string; update: string }
  | { type: 'yjs:sync-step-2'; fileId: string; update: string }
  | { type: 'file:created'; file: ProjectFile }
  | { type: 'file:deleted'; fileId: string }
  | { type: 'file:renamed'; fileId: string; newName: string }
  | { type: 'file:moved'; fileId: string; newParentId: string | null }
  | { type: 'role:updated'; uid: string; newRole: UserRole }
  | { type: 'chat:broadcast'; message: CollabChatMessage }
  | { type: 'session:saved'; timestamp: number }
  | { type: 'session:closed'; reason?: string }
  | { type: 'pong' };
