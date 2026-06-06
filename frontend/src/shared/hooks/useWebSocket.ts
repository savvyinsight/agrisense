import { useState, useEffect, useRef, useCallback } from 'react';
import type { WebSocketMessage } from '@/shared/types/api';

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

export const useWebSocket = (token: string | null, onMessage?: (data: WebSocketMessage) => void) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const tokenRef = useRef(token);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);

  // Keep refs current without triggering reconnection
  useEffect(() => { onMessageRef.current = onMessage; });
  useEffect(() => { tokenRef.current = token; });

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    // Read token from ref so reconnect always uses the latest token
    const currentToken = tokenRef.current;
    if (!currentToken || !mountedRef.current) return;

    cleanup();

    const ws = new WebSocket(`/ws?token=${currentToken}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setIsReconnecting(false);
      attemptRef.current = 0;
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as WebSocketMessage;
        onMessageRef.current?.(data);
      } catch (e) {
        console.error('Failed to parse message', e);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);

      // Schedule reconnect — reads token from ref, not closure
      if (mountedRef.current && tokenRef.current) {
        setIsReconnecting(true);
        const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, attemptRef.current), RECONNECT_MAX_MS);
        attemptRef.current++;
        console.log(`WebSocket reconnecting in ${delay}ms (attempt ${attemptRef.current})`);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, delay);
      }
    };

    ws.onerror = (error: Event) => {
      console.error('WebSocket error:', error);
    };
  }, [cleanup]);

  useEffect(() => {
    mountedRef.current = true;
    if (token) {
      attemptRef.current = 0;
      connect();
    }

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [token, connect, cleanup]);

  const send = useCallback((message: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return { isConnected, isReconnecting, send };
};
