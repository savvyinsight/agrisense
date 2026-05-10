import { useState, useEffect, useRef, useCallback} from 'react';
import type { WebSocketMessage } from '@/shared/types/api';

export const useWebSocket = (token: string | null, onMessage?: (data: WebSocketMessage) => void) => {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);// Store onMessage in a ref to avoid re-creating the WebSocket connection on every render

  useEffect(() => {
    onMessageRef.current = onMessage;//always current value of onMessage
  });

  useEffect(() => {
    if (!token) return;

    // Clean up previous WebSocket connection if it exists
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(`ws://localhost:8080/ws?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as WebSocketMessage;
        onMessageRef.current?.(data);//use ref,not prop, to avoid re-creating connection on every render
      } catch (e) {
        console.error('Failed to parse message', e);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };

    ws.onerror = (error: Event) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();//closes on EVERY re-render because onMessage changes every render
      }
    };
  }, [token]);//onMessage changes every render, only token triggers new connection

  const send = useCallback((message: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return { isConnected, send };
};