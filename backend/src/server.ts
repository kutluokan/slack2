import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { messageService, Message } from './services/messageService';
import { channelService } from './services/channelService';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'http://frontend:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://frontend:3000'],
  credentials: true
}));
app.use(express.json());

// Basic health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_channel', (channelId: string) => {
    socket.join(channelId);
  });

  socket.on('message', async (data: Message) => {
    try {
      // Save message to DynamoDB
      const savedMessage = await messageService.createMessage({
        ...data,
        timestamp: Date.now(),
      });

      // Broadcast the message to all clients in the channel
      io.to(data.channelId).emit('message', savedMessage);
    } catch (error) {
      console.error('Error saving message:', error);
      socket.emit('error', 'Failed to save message');
    }
  });

  socket.on('get_messages', async (channelId: string) => {
    try {
      const messages = await messageService.getChannelMessages(channelId);
      socket.emit('messages', messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      socket.emit('error', 'Failed to fetch messages');
    }
  });

  socket.on('create_channel', async (data) => {
    try {
      const channel = await channelService.createChannel(data);
      io.emit('channel_created', channel); // Broadcast to all clients
    } catch (error) {
      console.error('Error creating channel:', error);
      socket.emit('error', 'Failed to create channel');
    }
  });

  socket.on('get_channels', async () => {
    try {
      const channels = await channelService.getUserChannels(socket.data.userId);
      socket.emit('channels', channels);
    } catch (error) {
      console.error('Error fetching channels:', error);
      socket.emit('error', 'Failed to fetch channels');
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});