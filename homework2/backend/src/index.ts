import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { nanoid } from 'nanoid';
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

// Types
interface Session {
  id: string;
  code: string;
  language: string;
  createdAt: Date;
  participants: Set<WebSocket>;
}

interface WSMessage {
  type: 'code_update' | 'language_change' | 'cursor_update' | 'join' | 'leave';
  sessionId: string;
  data: any;
  userId?: string;
}

// In-memory session storage
const sessions = new Map<string, Session>();

// Hono app
const app = new Hono();

// CORS middleware
app.use('/*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

// Health check
app.get('/', (c) => {
  return c.json({ status: 'ok', message: 'CodeView Interview Platform API' });
});

// Create a new session
app.post('/api/sessions', (c) => {
  const id = nanoid(10);
  const session: Session = {
    id,
    code: '// Welcome to the coding interview!\n// Start writing your code here...\n\nfunction solution() {\n  // Your implementation\n}\n',
    language: 'javascript',
    createdAt: new Date(),
    participants: new Set(),
  };
  sessions.set(id, session);

  return c.json({
    id,
    shareLink: `http://localhost:5173/room/${id}`,
    createdAt: session.createdAt
  });
});

// Get session info
app.get('/api/sessions/:id', (c) => {
  const id = c.req.param('id');
  const session = sessions.get(id);

  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  return c.json({
    id: session.id,
    code: session.code,
    language: session.language,
    participantCount: session.participants.size,
    createdAt: session.createdAt,
  });
});

// List all active sessions (for debugging)
app.get('/api/sessions', (c) => {
  const sessionList = Array.from(sessions.values()).map(s => ({
    id: s.id,
    language: s.language,
    participantCount: s.participants.size,
    createdAt: s.createdAt,
  }));
  return c.json(sessionList);
});

const PORT = Number(process.env.PORT) || 3001;

// Start the Hono server and attach WebSocket
const server = serve({
  fetch: app.fetch,
  port: PORT,
}, (info) => {
  console.log(`🚀 CodeView Backend running on http://localhost:${info.port}`);
  console.log(`📡 WebSocket server ready`);
});

// WebSocket server attached to the same HTTP server
const wss = new WebSocketServer({ server: server as Server });

function broadcast(session: Session, message: any, exclude?: WebSocket) {
  const data = JSON.stringify(message);
  session.participants.forEach((client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

wss.on('connection', (ws: WebSocket) => {
  let currentSessionId: string | null = null;
  let userId = nanoid(8);

  ws.on('message', (data: Buffer) => {
    try {
      const message: WSMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'join': {
          const session = sessions.get(message.sessionId);
          if (session) {
            currentSessionId = message.sessionId;
            session.participants.add(ws);

            // Send current state to the new participant
            ws.send(JSON.stringify({
              type: 'init',
              data: {
                code: session.code,
                language: session.language,
                participantCount: session.participants.size,
                userId,
              }
            }));

            // Notify others
            broadcast(session, {
              type: 'user_joined',
              data: { participantCount: session.participants.size, userId }
            }, ws);
          } else {
            ws.send(JSON.stringify({ type: 'error', data: { message: 'Session not found' } }));
          }
          break;
        }

        case 'code_update': {
          const session = sessions.get(message.sessionId);
          if (session) {
            session.code = message.data.code;
            broadcast(session, {
              type: 'code_update',
              data: { code: message.data.code, userId }
            }, ws);
          }
          break;
        }

        case 'language_change': {
          const session = sessions.get(message.sessionId);
          if (session) {
            session.language = message.data.language;
            broadcast(session, {
              type: 'language_change',
              data: { language: message.data.language, userId }
            }, ws);
          }
          break;
        }

        case 'cursor_update': {
          const session = sessions.get(message.sessionId);
          if (session) {
            broadcast(session, {
              type: 'cursor_update',
              data: { ...message.data, userId }
            }, ws);
          }
          break;
        }
      }
    } catch (e) {
      console.error('WebSocket message error:', e);
    }
  });

  ws.on('close', () => {
    if (currentSessionId) {
      const session = sessions.get(currentSessionId);
      if (session) {
        session.participants.delete(ws);
        broadcast(session, {
          type: 'user_left',
          data: { participantCount: session.participants.size, userId }
        });

        // Clean up empty sessions after 1 hour
        if (session.participants.size === 0) {
          setTimeout(() => {
            const s = sessions.get(currentSessionId!);
            if (s && s.participants.size === 0) {
              sessions.delete(currentSessionId!);
            }
          }, 3600000);
        }
      }
    }
  });
});
