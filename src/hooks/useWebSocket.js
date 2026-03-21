import { useState, useEffect, useRef } from 'react';

export const useWebSocket = (token, onMessage) => {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!token) return;

    // Close existing connection first
    if (wsRef.current){
      wsRef.current.close()
    }
    const ws = new WebSocket(`ws://localhost:8080/ws?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onMessage) onMessage(data);
      } catch (e) {
        console.error('Failed to parse message',e)
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      if(wsRef.current && wsRef.current.readyState === WebSocket.OPEN){
        wsRef.current.close();
      }
    };
  }, [token]);  // Only reconnect when token changes

  const send = (message) => {
    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  return { isConnected, send };
};