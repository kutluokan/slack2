import io from 'socket.io-client';

interface CustomSocket extends ReturnType<typeof io> {
  auth?: {
    userId: string;
  };
  data?: {
    userId: string;
  };
}

const SOCKET_URL = typeof window !== 'undefined' 
  ? window.location.origin.replace(/^http/, 'ws')
  : 'ws://localhost:4000';

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: Infinity,
  timeout: 20000,
  transports: ['websocket', 'polling'],
  path: '/socket.io/'
}) as CustomSocket;

export const connectSocket = (userId: string) => {
  if (!userId) return;
  
  socket.auth = { userId };
  socket.data = { userId };
  
  if (!socket.connected) {
    socket.connect();
  }

  socket.on('connect_error', (error: Error) => {
    console.error('Socket connection error:', error);
    setTimeout(() => {
      socket.connect();
    }, 1000);
  });
}; 