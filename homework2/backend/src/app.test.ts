import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { WebSocket } from 'ws';
import { createApp, setupWebSocket, clearSessions, sessions } from './app.js';

// Helper to create a test server
function createTestServer() {
  const app = createApp();
  const server = createServer(async (req, res) => {
    const response = await app.fetch(
      new Request(`http://localhost${req.url}`, {
        method: req.method,
        headers: req.headers as HeadersInit,
      })
    );

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    const body = await response.text();
    res.end(body);
  });

  setupWebSocket(server);

  return server;
}

// Helper to wait for WebSocket message with type filter
function waitForMessage(ws: WebSocket, expectedType?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for message${expectedType ? ` of type ${expectedType}` : ''}`));
    }, 5000);

    const handler = (data: Buffer) => {
      const message = JSON.parse(data.toString());
      if (!expectedType || message.type === expectedType) {
        clearTimeout(timeout);
        ws.off('message', handler);
        resolve(message);
      }
    };

    ws.on('message', handler);
  });
}

// Helper to wait for WebSocket to open
function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
}

// Helper to collect messages
function collectMessages(ws: WebSocket, count: number, timeoutMs = 5000): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const messages: any[] = [];
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for ${count} messages, got ${messages.length}`));
    }, timeoutMs);

    const handler = (data: Buffer) => {
      messages.push(JSON.parse(data.toString()));
      if (messages.length >= count) {
        clearTimeout(timeout);
        ws.off('message', handler);
        resolve(messages);
      }
    };

    ws.on('message', handler);
  });
}

describe('REST API Integration Tests', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    clearSessions();
    server = createTestServer();
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe('GET /api/health', () => {
    it('should return health check status', async () => {
      const response = await fetch(`${baseUrl}/api/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.message).toBe('CodeView API');
    });
  });

  describe('POST /api/sessions', () => {
    it('should create a new session', async () => {
      const response = await fetch(`${baseUrl}/api/sessions`, {
        method: 'POST',
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBeDefined();
      expect(data.id.length).toBe(10);
      expect(data.shareLink).toContain(data.id);
      expect(data.createdAt).toBeDefined();
    });

    it('should create unique session IDs', async () => {
      const response1 = await fetch(`${baseUrl}/api/sessions`, { method: 'POST' });
      const response2 = await fetch(`${baseUrl}/api/sessions`, { method: 'POST' });

      const data1 = await response1.json();
      const data2 = await response2.json();

      expect(data1.id).not.toBe(data2.id);
    });

    it('should store session in memory', async () => {
      const response = await fetch(`${baseUrl}/api/sessions`, { method: 'POST' });
      const data = await response.json();

      expect(sessions.has(data.id)).toBe(true);
      expect(sessions.get(data.id)?.language).toBe('javascript');
    });
  });

  describe('GET /api/sessions/:id', () => {
    it('should return session details', async () => {
      // Create a session first
      const createResponse = await fetch(`${baseUrl}/api/sessions`, { method: 'POST' });
      const { id } = await createResponse.json();

      // Get session details
      const response = await fetch(`${baseUrl}/api/sessions/${id}`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(id);
      expect(data.code).toContain('Welcome to the coding interview');
      expect(data.language).toBe('javascript');
      expect(data.participantCount).toBe(0);
    });

    it('should return 404 for non-existent session', async () => {
      const response = await fetch(`${baseUrl}/api/sessions/nonexistent`);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Session not found');
    });
  });

  describe('GET /api/sessions', () => {
    it('should return empty list when no sessions exist', async () => {
      const response = await fetch(`${baseUrl}/api/sessions`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it('should return all active sessions', async () => {
      // Create two sessions
      await fetch(`${baseUrl}/api/sessions`, { method: 'POST' });
      await fetch(`${baseUrl}/api/sessions`, { method: 'POST' });

      const response = await fetch(`${baseUrl}/api/sessions`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.length).toBe(2);
      expect(data[0].language).toBe('javascript');
      expect(data[1].language).toBe('javascript');
    });
  });
});

describe('WebSocket Integration Tests', () => {
  let server: Server;
  let baseUrl: string;
  let wsUrl: string;

  beforeEach(async () => {
    clearSessions();
    server = createTestServer();
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://localhost:${address.port}`;
        wsUrl = `ws://localhost:${address.port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe('Session Join', () => {
    it('should join an existing session and receive init message', async () => {
      // Create a session
      const createResponse = await fetch(`${baseUrl}/api/sessions`, { method: 'POST' });
      const { id } = await createResponse.json();

      // Connect via WebSocket
      const ws = new WebSocket(wsUrl);
      await waitForOpen(ws);

      // Join session
      const messagePromise = waitForMessage(ws, 'init');
      ws.send(JSON.stringify({ type: 'join', sessionId: id }));

      const initMessage = await messagePromise;

      expect(initMessage.type).toBe('init');
      expect(initMessage.data.code).toContain('Welcome to the coding interview');
      expect(initMessage.data.language).toBe('javascript');
      expect(initMessage.data.participantCount).toBe(1);
      expect(initMessage.data.userId).toBeDefined();

      ws.close();
    });

    it('should return error when joining non-existent session', async () => {
      const ws = new WebSocket(wsUrl);
      await waitForOpen(ws);

      const messagePromise = waitForMessage(ws, 'error');
      ws.send(JSON.stringify({ type: 'join', sessionId: 'nonexistent' }));

      const errorMessage = await messagePromise;

      expect(errorMessage.type).toBe('error');
      expect(errorMessage.data.message).toBe('Session not found');

      ws.close();
    });

    it('should notify other participants when someone joins', async () => {
      // Create a session
      const createResponse = await fetch(`${baseUrl}/api/sessions`, { method: 'POST' });
      const { id } = await createResponse.json();

      // First participant joins
      const ws1 = new WebSocket(wsUrl);
      await waitForOpen(ws1);
      ws1.send(JSON.stringify({ type: 'join', sessionId: id }));
      await waitForMessage(ws1, 'init');

      // Set up listener for user_joined BEFORE second user joins
      const joinNotifyPromise = waitForMessage(ws1, 'user_joined');

      // Second participant joins
      const ws2 = new WebSocket(wsUrl);
      await waitForOpen(ws2);
      ws2.send(JSON.stringify({ type: 'join', sessionId: id }));
      await waitForMessage(ws2, 'init');

      const joinNotify = await joinNotifyPromise;

      expect(joinNotify.type).toBe('user_joined');
      expect(joinNotify.data.participantCount).toBe(2);

      ws1.close();
      ws2.close();
    });
  });

  describe('Code Updates', () => {
    it('should broadcast code updates to other participants', async () => {
      // Create a session
      const createResponse = await fetch(`${baseUrl}/api/sessions`, { method: 'POST' });
      const { id } = await createResponse.json();

      // Two participants join
      const ws1 = new WebSocket(wsUrl);
      const ws2 = new WebSocket(wsUrl);
      await Promise.all([waitForOpen(ws1), waitForOpen(ws2)]);

      // Set up listener for user_joined on ws1 BEFORE ws2 joins
      const userJoinedPromise = waitForMessage(ws1, 'user_joined');

      ws1.send(JSON.stringify({ type: 'join', sessionId: id }));
      await waitForMessage(ws1, 'init');

      ws2.send(JSON.stringify({ type: 'join', sessionId: id }));
      await waitForMessage(ws2, 'init');

      // Wait for user_joined notification on ws1
      await userJoinedPromise;

      // Set up listener for code_update on ws2 BEFORE ws1 sends
      const codeUpdatePromise = waitForMessage(ws2, 'code_update');

      // ws1 sends code update
      ws1.send(JSON.stringify({
        type: 'code_update',
        sessionId: id,
        data: { code: 'console.log("Hello, World!");' }
      }));

      const codeUpdate = await codeUpdatePromise;

      expect(codeUpdate.type).toBe('code_update');
      expect(codeUpdate.data.code).toBe('console.log("Hello, World!");');

      // Verify session was updated
      const session = sessions.get(id);
      expect(session?.code).toBe('console.log("Hello, World!");');

      ws1.close();
      ws2.close();
    });

    it('should not send code update back to sender', async () => {
      // Create a session
      const createResponse = await fetch(`${baseUrl}/api/sessions`, { method: 'POST' });
      const { id } = await createResponse.json();

      const ws1 = new WebSocket(wsUrl);
      await waitForOpen(ws1);

      ws1.send(JSON.stringify({ type: 'join', sessionId: id }));
      await waitForMessage(ws1, 'init');

      // Send code update
      ws1.send(JSON.stringify({
        type: 'code_update',
        sessionId: id,
        data: { code: 'test code' }
      }));

      // Should not receive the update back (wait a bit to ensure)
      const timeout = new Promise((resolve) => setTimeout(() => resolve('timeout'), 200));
      const message = new Promise((resolve) => {
        const handler = (data: Buffer) => {
          resolve(JSON.parse(data.toString()));
        };
        ws1.once('message', handler);
        setTimeout(() => ws1.off('message', handler), 200);
      });

      const result = await Promise.race([message, timeout]);
      expect(result).toBe('timeout');

      ws1.close();
    });
  });

  describe('Language Changes', () => {
    it('should broadcast language changes to other participants', async () => {
      // Create a session
      const createResponse = await fetch(`${baseUrl}/api/sessions`, { method: 'POST' });
      const { id } = await createResponse.json();

      // Two participants join
      const ws1 = new WebSocket(wsUrl);
      const ws2 = new WebSocket(wsUrl);
      await Promise.all([waitForOpen(ws1), waitForOpen(ws2)]);

      // Set up listener for user_joined on ws1
      const userJoinedPromise = waitForMessage(ws1, 'user_joined');

      ws1.send(JSON.stringify({ type: 'join', sessionId: id }));
      await waitForMessage(ws1, 'init');

      ws2.send(JSON.stringify({ type: 'join', sessionId: id }));
      await waitForMessage(ws2, 'init');

      await userJoinedPromise;

      // Set up listener for language_change on ws2
      const langChangePromise = waitForMessage(ws2, 'language_change');

      // ws1 changes language
      ws1.send(JSON.stringify({
        type: 'language_change',
        sessionId: id,
        data: { language: 'python' }
      }));

      const langChange = await langChangePromise;

      expect(langChange.type).toBe('language_change');
      expect(langChange.data.language).toBe('python');

      // Verify session was updated
      const session = sessions.get(id);
      expect(session?.language).toBe('python');

      ws1.close();
      ws2.close();
    });
  });

  describe('User Disconnect', () => {
    it('should notify other participants when someone leaves', async () => {
      // Create a session
      const createResponse = await fetch(`${baseUrl}/api/sessions`, { method: 'POST' });
      const { id } = await createResponse.json();

      // Two participants join
      const ws1 = new WebSocket(wsUrl);
      const ws2 = new WebSocket(wsUrl);
      await Promise.all([waitForOpen(ws1), waitForOpen(ws2)]);

      // Set up listener for user_joined
      const userJoinedPromise = waitForMessage(ws1, 'user_joined');

      ws1.send(JSON.stringify({ type: 'join', sessionId: id }));
      await waitForMessage(ws1, 'init');

      ws2.send(JSON.stringify({ type: 'join', sessionId: id }));
      await waitForMessage(ws2, 'init');

      await userJoinedPromise;

      // Set up listener for user_left BEFORE ws2 disconnects
      const leavePromise = waitForMessage(ws1, 'user_left');

      // ws2 disconnects
      ws2.close();

      const leaveNotify = await leavePromise;

      expect(leaveNotify.type).toBe('user_left');
      expect(leaveNotify.data.participantCount).toBe(1);

      ws1.close();
    });

    it('should update participant count when user disconnects', async () => {
      // Create a session
      const createResponse = await fetch(`${baseUrl}/api/sessions`, { method: 'POST' });
      const { id } = await createResponse.json();

      const ws = new WebSocket(wsUrl);
      await waitForOpen(ws);

      ws.send(JSON.stringify({ type: 'join', sessionId: id }));
      await waitForMessage(ws, 'init');

      expect(sessions.get(id)?.participants.size).toBe(1);

      ws.close();

      // Wait for close to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(sessions.get(id)?.participants.size).toBe(0);
    });
  });

  describe('Multiple Sessions', () => {
    it('should handle multiple independent sessions', async () => {
      // Create two sessions
      const res1 = await fetch(`${baseUrl}/api/sessions`, { method: 'POST' });
      const res2 = await fetch(`${baseUrl}/api/sessions`, { method: 'POST' });
      const { id: id1 } = await res1.json();
      const { id: id2 } = await res2.json();

      // Join different sessions
      const ws1 = new WebSocket(wsUrl);
      const ws2 = new WebSocket(wsUrl);
      await Promise.all([waitForOpen(ws1), waitForOpen(ws2)]);

      ws1.send(JSON.stringify({ type: 'join', sessionId: id1 }));
      ws2.send(JSON.stringify({ type: 'join', sessionId: id2 }));

      await waitForMessage(ws1, 'init');
      await waitForMessage(ws2, 'init');

      // Code update in session 1 should not affect session 2
      ws1.send(JSON.stringify({
        type: 'code_update',
        sessionId: id1,
        data: { code: 'session 1 code' }
      }));

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(sessions.get(id1)?.code).toBe('session 1 code');
      expect(sessions.get(id2)?.code).toContain('Welcome to the coding interview');

      ws1.close();
      ws2.close();
    });
  });
});
