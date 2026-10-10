import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import { 
  ClientMessage, 
  ServerMessage, 
  CollabSessionData, 
  ProjectFile, 
  UserRole, 
  ParticipantPresence,
  CursorPosition,
  CollabChatMessage 
} from '../src/lib/collab/types';

const COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#E11D48', // Rose
  '#84CC16', // Lime
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#D946EF', // Fuchsia
  '#F97316', // Orange
];

interface ConnectedClient {
  ws: WebSocket;
  sessionId: string;
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

interface ActiveSession {
  data: CollabSessionData;
  yDocs: Map<string, Y.Doc>;
  clients: Map<WebSocket, ConnectedClient>;
  chatMessages: CollabChatMessage[];
  saveTimeout?: NodeJS.Timeout;
}

// In-memory sessions store
const sessions = new Map<string, ActiveSession>();

export function getSession(sessionId: string): ActiveSession | undefined {
  return sessions.get(sessionId.toUpperCase());
}

export function getAllSessions(): CollabSessionData[] {
  return Array.from(sessions.values()).map(s => s.data);
}

export function createSession(
  ownerId: string, 
  ownerName: string, 
  projectName: string, 
  initialFiles: ProjectFile[],
  projectId?: string
): CollabSessionData {
  // Generate a clean 6-character code (e.g. "ABC123")
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  do {
    id = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (sessions.has(id));

  const now = Date.now();
  
  // Default files if none provided
  const files: ProjectFile[] = initialFiles.length > 0 ? initialFiles : [
    {
      id: 'main-file',
      name: 'main.epl',
      path: 'main.epl',
      content: '// Welcome to Together Create!\nstarted?\n  create{type=world, background=skyblue}\n  create{type=player, x=100, y=100, color=red}\n  create{type=text_label, text="Together Create Multiplayer", x=10, y=10, color=white}\nend',
      type: 'file',
      updatedAt: now
    }
  ];

  const sessionData: CollabSessionData = {
    id,
    projectId,
    projectName: projectName || 'Together Create Project',
    ownerId,
    ownerName,
    createdAt: now,
    updatedAt: now,
    files,
    roles: {
      [ownerId]: 'owner'
    },
    allowOfflineAccess: true
  };

  const yDocs = new Map<string, Y.Doc>();
  for (const f of files) {
    if (f.type === 'file') {
      const doc = new Y.Doc();
      const yText = doc.getText('code');
      yText.insert(0, f.content || '');
      yDocs.set(f.id, doc);
    }
  }

  sessions.set(id, {
    data: sessionData,
    yDocs,
    clients: new Map(),
    chatMessages: []
  });

  return sessionData;
}

function broadcastToSession(session: ActiveSession, message: ServerMessage, excludeWs?: WebSocket) {
  const payload = JSON.stringify(message);
  for (const [ws, client] of session.clients.entries()) {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(payload);
      } catch (err) {
        console.error(`Failed to send to client ${client.name}:`, err);
      }
    }
  }
}

function getParticipantPresence(client: ConnectedClient): ParticipantPresence {
  return {
    uid: client.uid,
    name: client.name,
    avatarUrl: client.avatarUrl,
    color: client.color,
    role: client.role,
    currentFileId: client.currentFileId,
    cursor: client.cursor,
    isTyping: client.isTyping,
    lastActive: client.lastActive
  };
}

export function setupCollabWebSocketServer(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket, req) => {
    let currentClient: ConnectedClient | null = null;

    ws.on('message', (rawData) => {
      try {
        const msg: ClientMessage = JSON.parse(rawData.toString());

        if (msg.type === 'ping') {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
          if (currentClient) {
            currentClient.lastActive = Date.now();
          }
          return;
        }

        if (msg.type === 'join') {
          const sessionId = msg.sessionId.toUpperCase().trim();
          let session = sessions.get(sessionId);

          // If session doesn't exist, create it if requested
          if (!session) {
            ws.send(JSON.stringify({
              type: 'session:error',
              error: `Session "${sessionId}" not found. Please verify code or create a new session.`,
              code: 'NOT_FOUND'
            }));
            return;
          }

          // Determine user's role
          const isOwner = session.data.ownerId === msg.user.uid;
          let role: UserRole = isOwner ? 'owner' : (session.data.roles[msg.user.uid] || 'editor');
          session.data.roles[msg.user.uid] = role;

          // Assign distinct color
          const clientCount = session.clients.size;
          const color = COLORS[clientCount % COLORS.length];

          // Determine starting active file
          const firstFile = session.data.files.find(f => f.type === 'file') || session.data.files[0];
          const initialFileId = firstFile ? firstFile.id : '';

          currentClient = {
            ws,
            sessionId,
            uid: msg.user.uid,
            name: msg.user.name || 'Developer',
            avatarUrl: msg.user.avatarUrl,
            color,
            role,
            currentFileId: initialFileId,
            cursor: null,
            isTyping: false,
            lastActive: Date.now()
          };

          // Remove any duplicate connection from same user in this session
          for (const [otherWs, otherClient] of session.clients.entries()) {
            if (otherClient.uid === msg.user.uid) {
              session.clients.delete(otherWs);
              try { otherWs.close(); } catch {}
            }
          }

          session.clients.set(ws, currentClient);

          // Build participants list
          const participants = Array.from(session.clients.values()).map(getParticipantPresence);

          // Send session init to the joined user
          const initMsg: ServerMessage = {
            type: 'session:init',
            session: session.data,
            yourRole: role,
            yourColor: color,
            participants
          };
          ws.send(JSON.stringify(initMsg));

          // Send Yjs initial state for each file
          for (const [fileId, doc] of session.yDocs.entries()) {
            const stateUpdate = Y.encodeStateAsUpdate(doc);
            const base64Update = Buffer.from(stateUpdate).toString('base64');
            ws.send(JSON.stringify({
              type: 'yjs:update',
              fileId,
              update: base64Update
            }));
          }

          // Broadcast to everyone else that a new participant joined
          broadcastToSession(session, {
            type: 'participant:joined',
            participant: getParticipantPresence(currentClient)
          }, ws);

          console.log(`[Collab] User ${msg.user.name} (${role}) joined session ${sessionId}`);
          return;
        }

        // All subsequent messages require an authenticated connection in a session
        if (!currentClient) {
          ws.send(JSON.stringify({
            type: 'session:error',
            error: 'Not joined to any session'
          }));
          return;
        }

        const session = sessions.get(currentClient.sessionId);
        if (!session) {
          ws.send(JSON.stringify({
            type: 'session:error',
            error: 'Session ended or not found'
          }));
          return;
        }

        currentClient.lastActive = Date.now();

        if (msg.type === 'leave') {
          handleClientLeave(ws, currentClient, session);
          currentClient = null;
          return;
        }

        if (msg.type === 'file:switch') {
          currentClient.currentFileId = msg.fileId;
          currentClient.cursor = null;
          currentClient.isTyping = false;

          broadcastToSession(session, {
            type: 'cursor:update',
            uid: currentClient.uid,
            fileId: msg.fileId,
            cursor: null,
            isTyping: false
          });
          return;
        }

        if (msg.type === 'cursor') {
          currentClient.currentFileId = msg.fileId;
          currentClient.cursor = {
            line: msg.line,
            ch: msg.ch,
            selection: msg.selection || null
          };
          currentClient.isTyping = msg.isTyping;

          broadcastToSession(session, {
            type: 'cursor:update',
            uid: currentClient.uid,
            fileId: msg.fileId,
            cursor: currentClient.cursor,
            isTyping: msg.isTyping
          }, ws);
          return;
        }

        if (msg.type === 'yjs:update') {
          // Permissions check: viewer cannot modify code
          if (currentClient.role === 'viewer') {
            ws.send(JSON.stringify({
              type: 'session:error',
              error: 'Viewers do not have edit permission'
            }));
            return;
          }

          const fileId = msg.fileId;
          let doc = session.yDocs.get(fileId);
          if (!doc) {
            doc = new Y.Doc();
            session.yDocs.set(fileId, doc);
          }

          const updateBuffer = Buffer.from(msg.update, 'base64');
          Y.applyUpdate(doc, new Uint8Array(updateBuffer), 'server');

          // Update the cached file content
          const yText = doc.getText('code');
          const file = session.data.files.find(f => f.id === fileId);
          if (file) {
            file.content = yText.toString();
            file.updatedAt = Date.now();
          }
          session.data.updatedAt = Date.now();

          // Broadcast the Yjs delta update to other participants
          broadcastToSession(session, {
            type: 'yjs:update',
            fileId,
            update: msg.update
          }, ws);
          return;
        }

        if (msg.type === 'file:create') {
          if (currentClient.role === 'viewer') {
            ws.send(JSON.stringify({ type: 'session:error', error: 'Viewers cannot create files' }));
            return;
          }

          const newFile = msg.file;
          // Ensure uniqueness
          session.data.files = session.data.files.filter(f => f.id !== newFile.id);
          session.data.files.push(newFile);

          if (newFile.type === 'file') {
            const doc = new Y.Doc();
            doc.getText('code').insert(0, newFile.content || '');
            session.yDocs.set(newFile.id, doc);
          }

          session.data.updatedAt = Date.now();

          broadcastToSession(session, {
            type: 'file:created',
            file: newFile
          });
          return;
        }

        if (msg.type === 'file:delete') {
          if (currentClient.role === 'viewer') {
            ws.send(JSON.stringify({ type: 'session:error', error: 'Viewers cannot delete files' }));
            return;
          }

          session.data.files = session.data.files.filter(f => f.id !== msg.fileId && f.parentId !== msg.fileId);
          session.yDocs.delete(msg.fileId);
          session.data.updatedAt = Date.now();

          broadcastToSession(session, {
            type: 'file:deleted',
            fileId: msg.fileId
          });
          return;
        }

        if (msg.type === 'file:rename') {
          if (currentClient.role === 'viewer') {
            ws.send(JSON.stringify({ type: 'session:error', error: 'Viewers cannot rename files' }));
            return;
          }

          const file = session.data.files.find(f => f.id === msg.fileId);
          if (file) {
            file.name = msg.newName;
            file.path = file.parentId ? `${file.path.split('/')[0]}/${msg.newName}` : msg.newName;
            file.updatedAt = Date.now();
            session.data.updatedAt = Date.now();

            broadcastToSession(session, {
              type: 'file:renamed',
              fileId: msg.fileId,
              newName: msg.newName
            });
          }
          return;
        }

        if (msg.type === 'file:move') {
          if (currentClient.role === 'viewer') {
            ws.send(JSON.stringify({ type: 'session:error', error: 'Viewers cannot move files' }));
            return;
          }

          const file = session.data.files.find(f => f.id === msg.fileId);
          if (file) {
            file.parentId = msg.newParentId;
            file.updatedAt = Date.now();
            session.data.updatedAt = Date.now();

            broadcastToSession(session, {
              type: 'file:moved',
              fileId: msg.fileId,
              newParentId: msg.newParentId
            });
          }
          return;
        }

        if (msg.type === 'role:update') {
          // Only owner can update roles
          if (currentClient.role !== 'owner') {
            ws.send(JSON.stringify({ type: 'session:error', error: 'Only the session owner can change roles' }));
            return;
          }

          session.data.roles[msg.targetUid] = msg.newRole;

          // Update connected client's role if online
          for (const c of session.clients.values()) {
            if (c.uid === msg.targetUid) {
              c.role = msg.newRole;
            }
          }

          broadcastToSession(session, {
            type: 'role:updated',
            uid: msg.targetUid,
            newRole: msg.newRole
          });
          return;
        }

        if (msg.type === 'chat:message') {
          const chatMsg: CollabChatMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            uid: currentClient.uid,
            name: currentClient.name,
            avatarUrl: currentClient.avatarUrl,
            text: msg.text,
            timestamp: Date.now()
          };

          session.chatMessages.push(chatMsg);
          if (session.chatMessages.length > 100) {
            session.chatMessages = session.chatMessages.slice(-100);
          }

          broadcastToSession(session, {
            type: 'chat:broadcast',
            message: chatMsg
          });
          return;
        }

        if (msg.type === 'session:save') {
          session.data.updatedAt = Date.now();
          broadcastToSession(session, {
            type: 'session:saved',
            timestamp: session.data.updatedAt
          });
          return;
        }

        if (msg.type === 'session:close') {
          if (currentClient.role !== 'owner') {
            ws.send(JSON.stringify({ type: 'session:error', error: 'Only owner can close session' }));
            return;
          }

          broadcastToSession(session, {
            type: 'session:closed',
            reason: 'Session ended by owner'
          });

          for (const clientWs of session.clients.keys()) {
            try { clientWs.close(); } catch {}
          }
          sessions.delete(currentClient.sessionId);
          return;
        }
      } catch (err: any) {
        console.error('[Collab] WS message error:', err);
      }
    });

    ws.on('close', () => {
      if (currentClient) {
        const session = sessions.get(currentClient.sessionId);
        if (session) {
          handleClientLeave(ws, currentClient, session);
        }
      }
    });

    ws.on('error', (err) => {
      console.error('[Collab] Socket error:', err);
    });
  });

  // Periodic heartbeat cleanup every 30s
  setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions.entries()) {
      for (const [ws, client] of session.clients.entries()) {
        if (ws.readyState !== WebSocket.OPEN) {
          handleClientLeave(ws, client, session);
        } else if (now - client.lastActive > 90000) {
          // Inactive for 90s, send ping or disconnect
          try { ws.ping(); } catch {}
        }
      }
    }
  }, 30000);
}

function handleClientLeave(ws: WebSocket, client: ConnectedClient, session: ActiveSession) {
  session.clients.delete(ws);
  broadcastToSession(session, {
    type: 'participant:left',
    uid: client.uid
  });
  console.log(`[Collab] User ${client.name} left session ${client.sessionId}`);
}
