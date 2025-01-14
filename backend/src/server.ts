import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { messageService, Message } from './services/messageService';
import { channelService } from './services/channelService';
import { userService } from './services/userService';

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
io.use((socket, next) => {
  const userId = socket.handshake.auth.userId;
  if (!userId) {
    return next(new Error("User ID not provided"));
  }
  socket.data.userId = userId;
  next();
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id, 'User ID:', socket.data.userId);

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

      // Check if message mentions @AI Assistant
      const mentionRegex = /@AI/;
      if (mentionRegex.test(data.content)) {
        // Get channel messages for context
        const messages = await messageService.getChannelMessages(data.channelId);
        
        // Generate and save AI response
        const aiResponse = await messageService.handleAIInteraction(
          data.channelId,
          messages.slice(-10), // Use last 10 messages for context
          savedMessage
        );

        // Broadcast AI response
        io.to(data.channelId).emit('message', aiResponse);
      }
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
      const channels = await channelService.getAllChannels();
      socket.emit('channels', channels);
    } catch (error) {
      console.error('Error fetching channels:', error);
      socket.emit('error', {
        type: 'CHANNELS_ERROR',
        message: 'Failed to fetch channels. Please try again later.'
      });
    }
  });

  socket.on('sync_user', async (userData) => {
    try {
      const user = await userService.createOrUpdateUser(userData);
      socket.emit('user_synced', user);
    } catch (error) {
      console.error('Error syncing user:', error);
      socket.emit('error', 'Failed to sync user data');
    }
  });

  socket.on('add_reaction', async (data) => {
    try {
      if (!data || !data.messageId || !data.emoji) {
        throw new Error('Missing required reaction data');
      }

      const userId = socket.data.userId;
      const [channelId] = data.messageId.split('#');
      
      if (!channelId) {
        throw new Error('Invalid message ID format');
      }

      const result = await messageService.addReaction(data.messageId, data.emoji, userId);
      io.to(channelId).emit('reaction_added', { 
        messageId: data.messageId, 
        emoji: data.emoji, 
        userId,
        reactions: result.reactions 
      });
    } catch (error) {
      console.error('Error adding reaction:', error);
      socket.emit('error', 'Failed to add reaction');
    }
  });

  socket.on('delete_message', async ({ messageId }) => {
    try {
      const [channelId] = messageId.split('#');
      if (!channelId) {
        throw new Error('Invalid message ID format');
      }

      await messageService.deleteMessage(messageId);
      io.to(channelId).emit('message_deleted', messageId);
    } catch (error) {
      console.error('Error deleting message:', error);
      socket.emit('error', 'Failed to delete message');
    }
  });

  socket.on('get_dm_channels', async ({ userId }) => {
    try {
      const channels = await channelService.getUserDMChannels(userId);
      socket.emit('dm_channels', channels);
    } catch (error) {
      console.error('Error getting DM channels:', error);
    }
  });

  socket.on('create_dm_channel', async ({ user1Id, user2Id }) => {
    try {
      const channel = await channelService.createDMChannel(user1Id, user2Id);
      io.emit('dm_channel_created', channel);
    } catch (error) {
      console.error('Error creating DM channel:', error);
    }
  });

  socket.on('get_users', async () => {
    try {
      const users = await userService.getAllUsers();
      socket.emit('users', users);
    } catch (error) {
      console.error('Error getting users:', error);
    }
  });

  socket.on('get_mentionable_users', async () => {
    try {
      const users = await userService.getMentionableUsers();
      socket.emit('mentionable_users', users);
    } catch (error) {
      console.error('Error getting mentionable users:', error);
      socket.emit('error', 'Failed to get mentionable users');
    }
  });

  socket.on('delete_channel', async (channelId: string) => {
    try {
      await channelService.deleteChannel(channelId);
      io.emit('channel_deleted', channelId); // Broadcast to all clients
    } catch (error) {
      console.error('Error deleting channel:', error);
      socket.emit('error', 'Failed to delete channel');
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