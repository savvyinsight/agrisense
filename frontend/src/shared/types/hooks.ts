// Hook Types
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

export interface WebSocketMessage {
  type: string;
  payload: unknown;
}

export interface MessageHandler {
  (data: WebSocketMessage): void;
}
