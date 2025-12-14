import { writable, get } from "svelte/store";

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface WSMessage {
  type: string;
  data: any;
}

function createWebSocketStore() {
  const { subscribe, set, update } = writable<{
    ws: WebSocket | null;
    state: ConnectionState;
    sessionId: string | null;
    userId: string | null;
    participantCount: number;
  }>({
    ws: null,
    state: 'disconnected',
    sessionId: null,
    userId: null,
    participantCount: 0,
  });

  const messageHandlers = new Map<string, (data: any) => void>();

  return {
    subscribe,

    connect(sessionId: string) {
      const currentState = get({ subscribe });
      if (currentState.ws) {
        currentState.ws.close();
      }

      update(s => ({ ...s, state: 'connecting', sessionId }));

      // Derive WebSocket URL from current location (same origin)
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        update(s => ({ ...s, state: 'connected', ws }));
        ws.send(JSON.stringify({ type: 'join', sessionId }));
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);

          if (message.type === 'init') {
            update(s => ({
              ...s,
              userId: message.data.userId,
              participantCount: message.data.participantCount
            }));
          }

          if (message.type === 'user_joined' || message.type === 'user_left') {
            update(s => ({ ...s, participantCount: message.data.participantCount }));
          }

          const handler = messageHandlers.get(message.type);
          if (handler) {
            handler(message.data);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onerror = () => {
        update(s => ({ ...s, state: 'error' }));
      };

      ws.onclose = () => {
        update(s => ({ ...s, state: 'disconnected', ws: null }));
      };

      update(s => ({ ...s, ws }));
    },

    disconnect() {
      const currentState = get({ subscribe });
      if (currentState.ws) {
        currentState.ws.close();
        update(s => ({ ...s, ws: null, state: 'disconnected', sessionId: null }));
      }
    },

    send(type: string, data: any) {
      const currentState = get({ subscribe });
      if (currentState.ws && currentState.ws.readyState === WebSocket.OPEN) {
        currentState.ws.send(JSON.stringify({
          type,
          sessionId: currentState.sessionId,
          data,
        }));
      }
    },

    on(type: string, handler: (data: any) => void) {
      messageHandlers.set(type, handler);
      return () => messageHandlers.delete(type);
    },

    off(type: string) {
      messageHandlers.delete(type);
    }
  };
}

export const wsStore = createWebSocketStore();

