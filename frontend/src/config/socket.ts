import io from 'socket.io-client';

interface CustomSocket extends ReturnType<typeof io> {
  auth?: {
    userId: string;
  };
  data?: {
    userId: string;
  };
}

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: Infinity,
  timeout: 10000,
  transports: ['websocket', 'polling']
}) as CustomSocket;

export const connectSocket = (userId: string) => {
  if (!userId) return;
  
  socket.auth = { userId };
  socket.data = { userId };
  
  if (!socket.connected) {
    socket.connect();
  }
  
  socket.on('connect', () => {
    console.log('Socket connected, syncing user data...');
    socket.emit('sync_user', { userId });
  });

  socket.on('connect_error', (err: Error) => {
    console.error('Socket connection error:', err);
    setTimeout(() => {
      if (!socket.connected) {
        socket.connect();
      }
    }, 2000);
  });

  socket.on('disconnect', (reason: string) => {
    console.log('Socket disconnected:', reason);
    if (reason === 'io server disconnect') {
      socket.connect();
    }
  });
}; 