/**
 * Integration tests that verify client-server interaction
 * Simulates real user flows as they would happen between frontend and backend
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { WebSocket, WebSocketServer } from 'ws';
import { createApp, setupWebSocket, clearSessions, sessions } from './app.js';

// Test server setup
let server: Server;
let wss: WebSocketServer;
let baseUrl: string;
let wsUrl: string;

beforeAll(async () => {
  const app = createApp();
  server = createServer(async (req, res) => {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers[key] = value;
    }

    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }

    const response = await app.fetch(
      new Request(`http://localhost${req.url}`, {
        method: req.method,
        headers,
        body: ['POST', 'PUT', 'PATCH'].includes(req.method!) && body ? body : undefined,
      })
    );

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    const responseBody = await response.text();
    res.end(responseBody);
  });

  wss = setupWebSocket(server);

  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const address = server.address() as AddressInfo;
      baseUrl = `http://localhost:${address.port}`;
      wsUrl = `ws://localhost:${address.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  // Close all WebSocket connections
  wss.clients.forEach((client) => {
    client.terminate();
  });

  // Close WebSocket server
  await new Promise<void>((resolve) => {
    wss.close(() => resolve());
  });

  // Close HTTP server
  await new Promise<void>((resolve) => {
    server.closeAllConnections();
    server.close(() => resolve());
  });
}, 15000);

beforeEach(() => {
  clearSessions();
});

// Client simulation helpers (mimics frontend behavior)
class InterviewClient {
  private ws: WebSocket | null = null;
  private messageQueue: any[] = [];
  private messageResolvers: ((msg: any) => void)[] = [];

  public userId: string | null = null;
  public sessionId: string | null = null;
  public currentCode: string = '';
  public currentLanguage: string = '';
  public participantCount: number = 0;

  // Simulate: Frontend creates a new session via REST API
  async createSession(): Promise<{ id: string; shareLink: string }> {
    const response = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.status}`);
    }

    const data = await response.json();
    this.sessionId = data.id;
    return data;
  }

  // Simulate: Frontend fetches session info before joining
  async getSessionInfo(sessionId: string): Promise<any> {
    const response = await fetch(`${baseUrl}/api/sessions/${sessionId}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Session not found');
      }
      throw new Error(`Failed to get session: ${response.status}`);
    }

    return response.json();
  }

  // Simulate: Frontend connects via WebSocket and joins session
  async joinSession(sessionId: string): Promise<void> {
    this.sessionId = sessionId;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        this.ws!.send(JSON.stringify({ type: 'join', sessionId }));
      });

      this.ws.on('message', (data) => {
        const message = JSON.parse(data.toString());

        // Handle init message specially - it resolves the join promise
        if (message.type === 'init') {
          this.userId = message.data.userId;
          this.currentCode = message.data.code;
          this.currentLanguage = message.data.language;
          this.participantCount = message.data.participantCount;
          resolve();
          return;
        }

        if (message.type === 'error') {
          reject(new Error(message.data.message));
          return;
        }

        // All other messages go through normal handling
        this.handleMessage(message);
      });

      this.ws.on('error', reject);
    });
  }

  private handleMessage(message: any) {
    // Update local state based on message type
    switch (message.type) {
      case 'code_update':
        this.currentCode = message.data.code;
        break;
      case 'language_change':
        this.currentLanguage = message.data.language;
        break;
      case 'user_joined':
      case 'user_left':
        this.participantCount = message.data.participantCount;
        break;
    }

    // Resolve any waiting message handlers
    if (this.messageResolvers.length > 0) {
      const resolver = this.messageResolvers.shift()!;
      resolver(message);
    } else {
      this.messageQueue.push(message);
    }
  }

  // Wait for next message
  async waitForMessage(timeoutMs = 5000): Promise<any> {
    if (this.messageQueue.length > 0) {
      return this.messageQueue.shift();
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for message'));
      }, timeoutMs);

      this.messageResolvers.push((msg) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });
  }

  // Wait for a specific message type
  async waitForMessageType(type: string, timeoutMs = 5000): Promise<any> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      // Check queue first
      const index = this.messageQueue.findIndex(m => m.type === type);
      if (index !== -1) {
        return this.messageQueue.splice(index, 1)[0];
      }

      // Wait for next message
      try {
        const msg = await this.waitForMessage(Math.max(100, timeoutMs - (Date.now() - startTime)));
        if (msg.type === type) {
          return msg;
        }
        // Put it back in queue if not the right type
        this.messageQueue.push(msg);
      } catch {
        // Timeout on individual wait, continue loop
      }
    }

    throw new Error(`Timeout waiting for message type: ${type}`);
  }

  // Simulate: User types code in editor
  sendCodeUpdate(code: string) {
    if (!this.ws || !this.sessionId) throw new Error('Not connected');
    this.ws.send(JSON.stringify({
      type: 'code_update',
      sessionId: this.sessionId,
      data: { code },
    }));
    this.currentCode = code; // Local state update
  }

  // Simulate: User changes language dropdown
  sendLanguageChange(language: string) {
    if (!this.ws || !this.sessionId) throw new Error('Not connected');
    this.ws.send(JSON.stringify({
      type: 'language_change',
      sessionId: this.sessionId,
      data: { language },
    }));
    this.currentLanguage = language; // Local state update
  }

  // Simulate: User closes browser/disconnects
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Helper to wait a bit
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Client-Server Integration: Complete User Flows', () => {

  describe('Flow: Interviewer creates session and shares link', () => {
    it('should create session and return shareable link', async () => {
      const interviewer = new InterviewClient();

      // Interviewer clicks "Create Session"
      const session = await interviewer.createSession();

      expect(session.id).toBeDefined();
      expect(session.id.length).toBe(10);
      expect(session.shareLink).toContain(session.id);
      expect(session.shareLink).toMatch(/^http:\/\/localhost:5173\/room\//);

      interviewer.disconnect();
    });

    it('should allow interviewer to join their own session', async () => {
      const interviewer = new InterviewClient();

      // Create session
      const session = await interviewer.createSession();

      // Join via WebSocket (happens when page loads)
      await interviewer.joinSession(session.id);

      expect(interviewer.isConnected()).toBe(true);
      expect(interviewer.userId).toBeDefined();
      expect(interviewer.currentCode).toContain('Welcome to the coding interview');
      expect(interviewer.currentLanguage).toBe('javascript');
      expect(interviewer.participantCount).toBe(1);

      interviewer.disconnect();
    });
  });

  describe('Flow: Candidate joins via shared link', () => {
    it('should allow candidate to join existing session', async () => {
      const interviewer = new InterviewClient();
      const candidate = new InterviewClient();

      // Interviewer creates and joins session
      const session = await interviewer.createSession();
      await interviewer.joinSession(session.id);

      // Candidate clicks shared link (fetches session info first)
      const sessionInfo = await candidate.getSessionInfo(session.id);
      expect(sessionInfo.id).toBe(session.id);

      // Candidate's page loads and connects
      await candidate.joinSession(session.id);

      expect(candidate.isConnected()).toBe(true);
      expect(candidate.participantCount).toBe(2);

      // Interviewer should be notified
      const notification = await interviewer.waitForMessageType('user_joined');
      expect(notification.type).toBe('user_joined');
      expect(notification.data.participantCount).toBe(2);

      interviewer.disconnect();
      candidate.disconnect();
    });

    it('should show error when candidate uses invalid link', async () => {
      const candidate = new InterviewClient();

      // Candidate tries to fetch non-existent session
      await expect(candidate.getSessionInfo('invalid123'))
        .rejects.toThrow('Session not found');

      // Candidate tries to join non-existent session via WebSocket
      await expect(candidate.joinSession('invalid123'))
        .rejects.toThrow('Session not found');
    });
  });

  describe('Flow: Real-time collaborative coding', () => {
    it('should sync code changes between interviewer and candidate', async () => {
      const interviewer = new InterviewClient();
      const candidate = new InterviewClient();

      // Both join session
      const session = await interviewer.createSession();
      await interviewer.joinSession(session.id);
      await candidate.joinSession(session.id);

      // Wait for interviewer to receive user_joined
      await interviewer.waitForMessageType('user_joined');

      // Candidate starts typing solution
      candidate.sendCodeUpdate('function solution(arr) {\n  // thinking...\n}');

      // Interviewer sees the change
      const update1 = await interviewer.waitForMessageType('code_update');
      expect(update1.type).toBe('code_update');
      expect(interviewer.currentCode).toBe('function solution(arr) {\n  // thinking...\n}');

      // Interviewer adds a hint
      interviewer.sendCodeUpdate('function solution(arr) {\n  // Hint: try using a hash map\n  // thinking...\n}');

      // Candidate sees the hint
      const update2 = await candidate.waitForMessageType('code_update');
      expect(update2.type).toBe('code_update');
      expect(candidate.currentCode).toContain('Hint: try using a hash map');

      interviewer.disconnect();
      candidate.disconnect();
    });

    it('should sync language changes between participants', async () => {
      const interviewer = new InterviewClient();
      const candidate = new InterviewClient();

      // Both join session
      const session = await interviewer.createSession();
      await interviewer.joinSession(session.id);
      await candidate.joinSession(session.id);

      // Wait for user_joined notification
      await interviewer.waitForMessageType('user_joined');

      // Both start with JavaScript
      expect(interviewer.currentLanguage).toBe('javascript');
      expect(candidate.currentLanguage).toBe('javascript');

      // Candidate prefers Python
      candidate.sendLanguageChange('python');

      // Interviewer sees the change
      const langChange = await interviewer.waitForMessageType('language_change');
      expect(langChange.type).toBe('language_change');
      expect(interviewer.currentLanguage).toBe('python');

      interviewer.disconnect();
      candidate.disconnect();
    });

    it('should handle rapid code changes (typing simulation)', async () => {
      const interviewer = new InterviewClient();
      const candidate = new InterviewClient();

      const session = await interviewer.createSession();
      await interviewer.joinSession(session.id);
      await candidate.joinSession(session.id);
      await interviewer.waitForMessageType('user_joined');

      // Simulate candidate typing character by character
      const finalCode = 'console.log("Hello");';
      for (let i = 1; i <= finalCode.length; i++) {
        candidate.sendCodeUpdate(finalCode.substring(0, i));
      }

      // Wait for all updates to propagate
      await wait(200);

      // Verify final state
      const sessionInfo = await interviewer.getSessionInfo(session.id);
      expect(sessionInfo.code).toBe(finalCode);
      expect(interviewer.currentCode).toBe(finalCode);

      interviewer.disconnect();
      candidate.disconnect();
    });
  });

  describe('Flow: Multiple participants in interview', () => {
    it('should support 3+ participants (panel interview)', async () => {
      const interviewer1 = new InterviewClient();
      const interviewer2 = new InterviewClient();
      const candidate = new InterviewClient();

      // First interviewer creates session
      const session = await interviewer1.createSession();
      await interviewer1.joinSession(session.id);

      // Second interviewer joins
      await interviewer2.joinSession(session.id);
      await interviewer1.waitForMessageType('user_joined');

      // Candidate joins
      await candidate.joinSession(session.id);

      // Both interviewers should be notified
      const notify1 = await interviewer1.waitForMessageType('user_joined');
      const notify2 = await interviewer2.waitForMessageType('user_joined');

      expect(notify1.type).toBe('user_joined');
      expect(notify2.type).toBe('user_joined');
      expect(candidate.participantCount).toBe(3);

      // Code update should reach all participants
      candidate.sendCodeUpdate('// Solution by candidate');

      const update1 = await interviewer1.waitForMessageType('code_update');
      const update2 = await interviewer2.waitForMessageType('code_update');

      expect(update1.data.code).toBe('// Solution by candidate');
      expect(update2.data.code).toBe('// Solution by candidate');

      interviewer1.disconnect();
      interviewer2.disconnect();
      candidate.disconnect();
    });
  });

  describe('Flow: Participant disconnection handling', () => {
    it('should notify when candidate disconnects', async () => {
      const interviewer = new InterviewClient();
      const candidate = new InterviewClient();

      const session = await interviewer.createSession();
      await interviewer.joinSession(session.id);
      await candidate.joinSession(session.id);

      // Wait for user_joined
      await interviewer.waitForMessageType('user_joined');
      expect(interviewer.participantCount).toBe(2);

      // Candidate closes browser
      candidate.disconnect();

      // Interviewer gets notified
      const notification = await interviewer.waitForMessageType('user_left');
      expect(notification.type).toBe('user_left');
      expect(notification.data.participantCount).toBe(1);
      expect(interviewer.participantCount).toBe(1);

      interviewer.disconnect();
    });

    it('should preserve code when all participants leave and rejoin', async () => {
      const user1 = new InterviewClient();
      const user2 = new InterviewClient();

      const session = await user1.createSession();
      await user1.joinSession(session.id);

      // User writes some code
      user1.sendCodeUpdate('const answer = 42;');
      await wait(50);

      // User disconnects
      user1.disconnect();
      await wait(50);

      // New user joins with same session ID
      await user2.joinSession(session.id);

      // Code should be preserved
      expect(user2.currentCode).toBe('const answer = 42;');

      user2.disconnect();
    });
  });

  describe('Flow: Session isolation', () => {
    it('should keep separate sessions completely isolated', async () => {
      const interview1User = new InterviewClient();
      const interview2User = new InterviewClient();

      // Two separate interviews happening
      const session1 = await interview1User.createSession();
      const session2 = await interview2User.createSession();

      await interview1User.joinSession(session1.id);
      await interview2User.joinSession(session2.id);

      // User 1 writes code
      interview1User.sendCodeUpdate('Interview 1: Binary Search');

      // User 2 writes different code
      interview2User.sendCodeUpdate('Interview 2: Linked List');

      await wait(50);

      // Verify sessions are isolated
      const info1 = await interview1User.getSessionInfo(session1.id);
      const info2 = await interview2User.getSessionInfo(session2.id);

      expect(info1.code).toBe('Interview 1: Binary Search');
      expect(info2.code).toBe('Interview 2: Linked List');

      // Neither user received the other's update
      expect(interview1User.currentCode).toBe('Interview 1: Binary Search');
      expect(interview2User.currentCode).toBe('Interview 2: Linked List');

      interview1User.disconnect();
      interview2User.disconnect();
    });
  });

  describe('Flow: Late joiner catches up', () => {
    it('should give late joiner the current state', async () => {
      const interviewer = new InterviewClient();
      const candidate = new InterviewClient();

      // Interviewer sets up the session
      const session = await interviewer.createSession();
      await interviewer.joinSession(session.id);

      // Interviewer prepares the problem
      interviewer.sendCodeUpdate('// Problem: Two Sum\n// Given an array, find two numbers that add up to target');
      interviewer.sendLanguageChange('python');

      await wait(50);

      // Candidate joins late
      await candidate.joinSession(session.id);

      // Candidate should see current state immediately
      expect(candidate.currentCode).toContain('Problem: Two Sum');
      expect(candidate.currentLanguage).toBe('python');
      expect(candidate.participantCount).toBe(2);

      interviewer.disconnect();
      candidate.disconnect();
    });
  });
});
