import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('[Socket] 서버 연결됨:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] 연결 해제:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] 연결 오류:', err.message);
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function subscribeToAlerts(callback) {
  const s = getSocket();
  s.on('alert', callback);
  return () => s.off('alert', callback);
}
