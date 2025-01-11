import io from 'socket.io-client';

interface CustomSocket extends ReturnType<typeof io> {
  auth?: {
    userId: string;
  };
}

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
}) as CustomSocket;

export const connectSocket = (userId: string) => {
  if (!userId) return;
  
  socket.auth = { userId };
  
  if (!socket.connected) {
    socket.connect();
  }
  
  socket.on('connect', () => {
    console.log('Socket connected, syncing user data...');
  });

  socket.on('connect_error', (err: Error) => {
    console.error('Socket connection error:', err);
  });
}; 