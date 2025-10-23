// Log entry for the frontend
export interface LogEntry {
  id: number;
  source: 'user' | 'agent' | 'system';
  text: string;
  timestamp: string;
}

// Full call session data
export interface CallSession {
  callSid: string;
  theme: string;
  outline: string;
  voiceId: string;
  logs: LogEntry[];
  convoState?: {
    currentBeat: number;
    beats: string[];
    startTime: number;
  };
}

/**
 * A simple in-memory store for active call sessions.
 * In production, this should be replaced with Redis or a database
 * to handle multiple server instances.
 */
class SessionStore {
  private store: Map<string, CallSession>;

  constructor() {
    this.store = new Map<string, CallSession>();
  }

  get(callSid: string): CallSession | undefined {
    return this.store.get(callSid);
  }

  set(callSid: string, session: CallSession): void {
    this.store.set(callSid, session);
  }

  delete(callSid: string): void {
    this.store.delete(callSid);
  }

  getAll(): CallSession[] {
    return Array.from(this.store.values());
  }
}

// Export a singleton instance
export const sessionStore = new SessionStore();
