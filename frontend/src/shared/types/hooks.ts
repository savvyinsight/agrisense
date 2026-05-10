// Hook Types
import type { WebSocketMessage } from './api';

export interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  send: (message: unknown) => void;
}

export interface MessageHandler {
  (data: WebSocketMessage): void;
}
