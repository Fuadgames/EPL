import * as Y from 'yjs';
import {
  ClientMessage,
  ServerMessage,
  CollabSessionData,
  ProjectFile,
  UserRole,
  ParticipantPresence,
  CursorPosition,
  ConnectionStatus,
  CollabChatMessage
} from './types';

type Listener = () => void;

class CollabClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();

  // State
  public status: ConnectionStatus = 'offline';
  public session: CollabSessionData | null = null;
  public yourRole: UserRole = 'editor';
  public yourColor: string = '#3B82F6';
  public participants = new Map<string, ParticipantPresence>();
  public currentFileId: string = '';
  public chatMessages: CollabChatMessage[] = [];
  public errorMessage: string | null = null;

  // Yjs documents per fileId
  private yDocs = new Map<string, Y.Doc>();
  private localCodeCache = new Map<string, string>();
  private isApplyingRemoteUpdate = false;

  // Reconnection & presence timers
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private typingTimer: NodeJS.Timeout | null = null;
  private cursorThrottleTimer: NodeJS.Timeout | null = null;
  private pendingCursor: { fileId: string; line: number; ch: number; selection?: CursorPosition['selection']; isTyping: boolean } | null = null;

  private currentUser: { uid: string; name: string; avatarUrl?: string } | null = null;
  private currentSessionId: string | null = null;

  constructor() {
    // Check if session was saved in localStorage for automatic reconnect
    const saved = localStorage.getItem('epl_collab_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.sessionId && parsed?.user) {
          this.currentSessionId = parsed.sessionId;
          this.currentUser = parsed.user;
        }
      } catch {}
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      try { listener(); } catch (err) { console.error(err); }
    }
  }

  public getCode(fileId: string): string {
    const yDoc = this.yDocs.get(fileId);
    if (yDoc) {
      return yDoc.getText('code').toString();
    }
    const file = this.session?.files.find(f => f.id === fileId);
    return file?.content || this.localCodeCache.get(fileId) || '';
  }

  public getFile(fileId: string): ProjectFile | undefined {
    return this.session?.files.find(f => f.id === fileId);
  }

  public getOtherParticipantsInFile(fileId: string): ParticipantPresence[] {
    const list: ParticipantPresence[] = [];
    for (const p of this.participants.values()) {
      if (p.uid !== this.currentUser?.uid && p.currentFileId === fileId) {
        list.push(p);
      }
    }
    return list;
  }

  public getAllParticipants(): ParticipantPresence[] {
    return Array.from(this.participants.values());
  }

  public join(sessionId: string, user: { uid: string; name: string; avatarUrl?: string }) {
    this.currentSessionId = sessionId.toUpperCase().trim();
    this.currentUser = user;
    this.errorMessage = null;

    localStorage.setItem('epl_collab_session', JSON.stringify({
      sessionId: this.currentSessionId,
      user: this.currentUser
    }));

    this.connect();
  }

  public leave() {
    if (this.currentSessionId) {
      this.send({ type: 'leave', sessionId: this.currentSessionId });
    }
    this.cleanup();
    localStorage.removeItem('epl_collab_session');
    this.session = null;
    this.participants.clear();
    this.yDocs.clear();
    this.status = 'offline';
    this.currentSessionId = null;
    this.notify();
  }

  private connect() {
    if (!this.currentSessionId || !this.currentUser) return;

    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }

    this.status = this.reconnectAttempts > 0 ? 'reconnecting' : 'offline';
    this.notify();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/collab`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.status = 'connected';
        this.reconnectAttempts = 0;
        this.errorMessage = null;

        // Send Join message
        this.send({
          type: 'join',
          sessionId: this.currentSessionId!,
          user: this.currentUser!
        });

        // Setup ping keepalive
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          this.send({ type: 'ping' });
        }, 15000);

        this.notify();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: ServerMessage = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (err) {
          console.error('[CollabClient] Error parsing message:', err);
        }
      };

      this.ws.onclose = () => {
        if (this.status === 'connected') {
          this.status = 'reconnecting';
          this.scheduleReconnect();
        }
        this.notify();
      };

      this.ws.onerror = (err) => {
        console.error('[CollabClient] WebSocket error:', err);
        if (this.status !== 'connected') {
          this.status = 'offline';
        }
        this.notify();
      };
    } catch (err) {
      console.error('[CollabClient] Connection failed:', err);
      this.status = 'offline';
      this.scheduleReconnect();
      this.notify();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (!this.currentSessionId) return;

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
    this.reconnectTimer = setTimeout(() => {
      console.log(`[CollabClient] Reconnecting (attempt ${this.reconnectAttempts})...`);
      this.connect();
    }, delay);
  }

  private cleanup() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.typingTimer) clearTimeout(this.typingTimer);
    if (this.cursorThrottleTimer) clearTimeout(this.cursorThrottleTimer);
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
  }

  private send(msg: ClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleServerMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'session:init': {
        this.session = msg.session;
        this.yourRole = msg.yourRole;
        this.yourColor = msg.yourColor;
        this.participants.clear();

        for (const p of msg.participants) {
          this.participants.set(p.uid, p);
        }

        // Initialize Y.Docs for each file
        for (const f of msg.session.files) {
          if (f.type === 'file') {
            let doc = this.yDocs.get(f.id);
            if (!doc) {
              doc = new Y.Doc();
              this.setupYDocListeners(doc, f.id);
              this.yDocs.set(f.id, doc);
            }
          }
        }

        // Set initial active file if not set
        if (!this.currentFileId && msg.session.files.length > 0) {
          const firstFile = msg.session.files.find(f => f.type === 'file') || msg.session.files[0];
          this.currentFileId = firstFile.id;
        }

        this.notify();
        break;
      }

      case 'session:error': {
        this.errorMessage = msg.error;
        this.notify();
        break;
      }

      case 'participant:joined': {
        this.participants.set(msg.participant.uid, msg.participant);
        this.notify();
        break;
      }

      case 'participant:left': {
        this.participants.delete(msg.uid);
        this.notify();
        break;
      }

      case 'cursor:update': {
        const participant = this.participants.get(msg.uid);
        if (participant) {
          participant.currentFileId = msg.fileId;
          participant.cursor = msg.cursor;
          participant.isTyping = msg.isTyping;
          participant.lastActive = Date.now();
          this.notify();
        }
        break;
      }

      case 'yjs:update': {
        const doc = this.yDocs.get(msg.fileId);
        if (doc) {
          try {
            this.isApplyingRemoteUpdate = true;
            const binary = Uint8Array.from(atob(msg.update), c => c.charCodeAt(0));
            Y.applyUpdate(doc, binary, 'remote');
            
            const updatedText = doc.getText('code').toString();
            this.localCodeCache.set(msg.fileId, updatedText);

            // Update file content in session files
            if (this.session) {
              const file = this.session.files.find(f => f.id === msg.fileId);
              if (file) {
                file.content = updatedText;
              }
            }
          } finally {
            this.isApplyingRemoteUpdate = false;
          }
          this.notify();
        }
        break;
      }

      case 'file:created': {
        if (this.session) {
          this.session.files = this.session.files.filter(f => f.id !== msg.file.id);
          this.session.files.push(msg.file);

          if (msg.file.type === 'file') {
            let doc = this.yDocs.get(msg.file.id);
            if (!doc) {
              doc = new Y.Doc();
              this.setupYDocListeners(doc, msg.file.id);
              doc.getText('code').insert(0, msg.file.content || '');
              this.yDocs.set(msg.file.id, doc);
            }
          }
          this.notify();
        }
        break;
      }

      case 'file:deleted': {
        if (this.session) {
          this.session.files = this.session.files.filter(f => f.id !== msg.fileId && f.parentId !== msg.fileId);
          this.yDocs.delete(msg.fileId);

          // If current file was deleted, switch to another file
          if (this.currentFileId === msg.fileId) {
            const nextFile = this.session.files.find(f => f.type === 'file');
            if (nextFile) {
              this.switchFile(nextFile.id);
            }
          }
          this.notify();
        }
        break;
      }

      case 'file:renamed': {
        if (this.session) {
          const file = this.session.files.find(f => f.id === msg.fileId);
          if (file) {
            file.name = msg.newName;
            this.notify();
          }
        }
        break;
      }

      case 'file:moved': {
        if (this.session) {
          const file = this.session.files.find(f => f.id === msg.fileId);
          if (file) {
            file.parentId = msg.newParentId;
            this.notify();
          }
        }
        break;
      }

      case 'role:updated': {
        if (this.session) {
          this.session.roles[msg.uid] = msg.newRole;
          if (this.currentUser?.uid === msg.uid) {
            this.yourRole = msg.newRole;
          }
          const participant = this.participants.get(msg.uid);
          if (participant) {
            participant.role = msg.newRole;
          }
          this.notify();
        }
        break;
      }

      case 'chat:broadcast': {
        this.chatMessages.push(msg.message);
        if (this.chatMessages.length > 100) {
          this.chatMessages = this.chatMessages.slice(-100);
        }
        this.notify();
        break;
      }

      case 'session:saved': {
        if (this.session) {
          this.session.updatedAt = msg.timestamp;
          this.notify();
        }
        break;
      }

      case 'session:closed': {
        this.leave();
        break;
      }
    }
  }

  private setupYDocListeners(doc: Y.Doc, fileId: string) {
    doc.on('update', (update: Uint8Array, origin: any) => {
      if (origin !== 'remote' && this.currentSessionId && this.status === 'connected') {
        // Send delta update to server
        const base64 = btoa(String.fromCharCode.apply(null, Array.from(update)));
        this.send({
          type: 'yjs:update',
          sessionId: this.currentSessionId,
          fileId,
          update: base64
        });
      }
    });
  }

  /**
   * Called by local editor when code is edited locally.
   * Updates Yjs document with diff to preserve CRDT state.
   */
  public updateCode(fileId: string, newCode: string) {
    if (this.yourRole === 'viewer') return; // Viewers cannot edit
    if (this.isApplyingRemoteUpdate) return;

    let doc = this.yDocs.get(fileId);
    if (!doc) {
      doc = new Y.Doc();
      this.setupYDocListeners(doc, fileId);
      this.yDocs.set(fileId, doc);
    }

    const yText = doc.getText('code');
    const oldCode = yText.toString();

    if (oldCode === newCode) return;

    // Fast diff & replace in Y.Doc
    doc.transact(() => {
      // Find common prefix
      let start = 0;
      while (start < oldCode.length && start < newCode.length && oldCode[start] === newCode[start]) {
        start++;
      }

      // Find common suffix
      let oldEnd = oldCode.length;
      let newEnd = newCode.length;
      while (oldEnd > start && newEnd > start && oldCode[oldEnd - 1] === newCode[newEnd - 1]) {
        oldEnd--;
        newEnd--;
      }

      const deleteLength = oldEnd - start;
      const insertString = newCode.slice(start, newEnd);

      if (deleteLength > 0) {
        yText.delete(start, deleteLength);
      }
      if (insertString.length > 0) {
        yText.insert(start, insertString);
      }
    });

    this.localCodeCache.set(fileId, newCode);
    if (this.session) {
      const file = this.session.files.find(f => f.id === fileId);
      if (file) file.content = newCode;
    }

    // Trigger typing state
    this.setTyping(fileId, true);
  }

  public updateCursor(fileId: string, line: number, ch: number, selection?: CursorPosition['selection']) {
    this.pendingCursor = {
      fileId,
      line,
      ch,
      selection: selection || null,
      isTyping: false
    };

    if (!this.cursorThrottleTimer) {
      this.cursorThrottleTimer = setTimeout(() => {
        if (this.pendingCursor && this.currentSessionId) {
          this.send({
            type: 'cursor',
            sessionId: this.currentSessionId,
            fileId: this.pendingCursor.fileId,
            line: this.pendingCursor.line,
            ch: this.pendingCursor.ch,
            selection: this.pendingCursor.selection,
            isTyping: this.pendingCursor.isTyping
          });
        }
        this.cursorThrottleTimer = null;
      }, 40);
    }
  }

  public setTyping(fileId: string, isTyping: boolean) {
    if (this.pendingCursor) {
      this.pendingCursor.isTyping = isTyping;
    }

    if (this.currentSessionId && this.pendingCursor) {
      this.send({
        type: 'cursor',
        sessionId: this.currentSessionId,
        fileId,
        line: this.pendingCursor.line,
        ch: this.pendingCursor.ch,
        selection: this.pendingCursor.selection,
        isTyping
      });
    }

    if (this.typingTimer) clearTimeout(this.typingTimer);
    if (isTyping) {
      this.typingTimer = setTimeout(() => {
        this.setTyping(fileId, false);
      }, 1200);
    }
  }

  public switchFile(fileId: string) {
    this.currentFileId = fileId;
    if (this.currentSessionId) {
      this.send({
        type: 'file:switch',
        sessionId: this.currentSessionId,
        fileId
      });
    }
    this.notify();
  }

  public createFile(name: string, type: 'file' | 'folder' = 'file', parentId: string | null = null, content: string = '') {
    if (this.yourRole === 'viewer') return;
    if (!this.currentSessionId) return;

    const id = `f_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const path = parentId ? `${parentId}/${name}` : name;

    const newFile: ProjectFile = {
      id,
      name,
      path,
      content,
      type,
      parentId,
      updatedAt: Date.now()
    };

    this.send({
      type: 'file:create',
      sessionId: this.currentSessionId,
      file: newFile
    });

    if (type === 'file') {
      this.switchFile(id);
    }
  }

  public deleteFile(fileId: string) {
    if (this.yourRole === 'viewer') return;
    if (!this.currentSessionId) return;

    this.send({
      type: 'file:delete',
      sessionId: this.currentSessionId,
      fileId
    });
  }

  public renameFile(fileId: string, newName: string) {
    if (this.yourRole === 'viewer') return;
    if (!this.currentSessionId) return;

    this.send({
      type: 'file:rename',
      sessionId: this.currentSessionId,
      fileId,
      newName
    });
  }

  public moveFile(fileId: string, newParentId: string | null) {
    if (this.yourRole === 'viewer') return;
    if (!this.currentSessionId) return;

    this.send({
      type: 'file:move',
      sessionId: this.currentSessionId,
      fileId,
      newParentId
    });
  }

  public updateRole(targetUid: string, newRole: UserRole) {
    if (this.yourRole !== 'owner') return;
    if (!this.currentSessionId) return;

    this.send({
      type: 'role:update',
      sessionId: this.currentSessionId,
      targetUid,
      newRole
    });
  }

  public sendChatMessage(text: string) {
    if (!this.currentSessionId || !text.trim()) return;
    this.send({
      type: 'chat:message',
      sessionId: this.currentSessionId,
      text: text.trim()
    });
  }

  public save() {
    if (!this.currentSessionId) return;
    this.send({
      type: 'session:save',
      sessionId: this.currentSessionId
    });
  }
}

export const collabClient = new CollabClient();
