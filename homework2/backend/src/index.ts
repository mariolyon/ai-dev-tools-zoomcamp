import { serve } from '@hono/node-server';
import type { Server } from 'http';
import { createApp, setupWebSocket } from './app.js';

const app = createApp();
const PORT = Number(process.env.PORT) || 3001;

// Start the Hono server and attach WebSocket
const server = serve({
  fetch: app.fetch,
  port: PORT,
}, (info) => {
  console.log(`🚀 CodeView Backend running on http://localhost:${info.port}`);
  console.log(`📡 WebSocket server ready`);
});

// Setup WebSocket
setupWebSocket(server as Server);
