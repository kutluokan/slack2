import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { messageService, Message } from './services/messageService';
import { channelService } from './services/channelService';
import { userService } from './services/userService';
import { s3Service } from './services/s3Service';
import { searchService } from './services/searchService';
import { dmService } from './services/dmService';
import path from 'path';
import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Configure multer for file uploads
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
console.log('Upload directory path:', UPLOAD_DIR);

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  console.log('Creating upload directory at:', UPLOAD_DIR);
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR)
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    cb(null, `${timestamp}-${file.originalname}`)
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

const allowedOrigins = process.env.PUBLIC_URLS?.split(',') || [
  'http://localhost:3000',
  'http://frontend:3000',
  'http://ec2-18-189-195-81.us-east-2.compute.amazonaws.com',
  'https://ec2-18-189-195-81.us-east-2.compute.amazonaws.com'
];

const io = new Server(httpServer, {
  path: '/socket.io/',
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Increase payload size limit for JSON and URL-encoded data
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

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

      // If this is a thread reply, also emit a thread_updated event and update parent message
      if (savedMessage.parentMessageId) {
        const threadMessages = await messageService.getThreadMessages(savedMessage.parentMessageId);
        const parentMessage = await messageService.getMessage(savedMessage.parentMessageId);
        
        io.to(data.channelId).emit('thread_updated', {
          parentMessageId: savedMessage.parentMessageId,
          messages: threadMessages
        });

        // Emit parent message update to update thread count in real-time
        if (parentMessage) {
          io.to(data.channelId).emit('message_updated', parentMessage);
        }
      }

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

      const message = await messageService.getMessage(messageId);
      await messageService.deleteMessage(messageId);
      io.to(channelId).emit('message_deleted', messageId);

      // If this was a thread message, update the thread
      if (message?.parentMessageId) {
        const threadMessages = await messageService.getThreadMessages(message.parentMessageId);
        io.to(channelId).emit('thread_updated', {
          parentMessageId: message.parentMessageId,
          messages: threadMessages
        });
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      socket.emit('error', 'Failed to delete message');
    }
  });

  socket.on('get_dm_channels', async ({ userId }) => {
    try {
      const channels = await dmService.getUserDMChannels(userId);
      socket.emit('dm_channels', channels);
    } catch (error) {
      console.error('Error getting DM channels:', error);
    }
  });

  socket.on('create_dm_channel', async ({ user1Id, user2Id }) => {
    try {
      const channel = await dmService.createOrGetDM([user1Id, user2Id]);
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

  socket.on('request_upload_url', async (fileData: { fileName: string; fileType: string; fileSize: number }) => {
    try {
      const uploadData = await s3Service.getUploadPresignedUrl(fileData);
      socket.emit('upload_url_generated', uploadData);
    } catch (error) {
      console.error('Error generating upload URL:', error);
      socket.emit('error', 'Failed to generate upload URL');
    }
  });

  socket.on('message_with_file', async (data: Message) => {
    try {
      // Save message to DynamoDB
      const savedMessage = await messageService.createMessage({
        ...data,
        timestamp: Date.now(),
      });

      // Broadcast the message to all clients in the channel
      io.to(data.channelId).emit('message', savedMessage);
    } catch (error) {
      console.error('Error saving message with file:', error);
      socket.emit('error', 'Failed to save message with file');
    }
  });

  socket.on('search_messages', async ({ query }) => {
    try {
      const results = await searchService.searchMessages(query, socket.data.userId);
      socket.emit('search_results', results);
    } catch (error) {
      console.error('Error searching messages:', error);
      socket.emit('error', 'Failed to search messages');
    }
  });

  socket.on('get_thread_messages', async (parentMessageId: string) => {
    try {
      const messages = await messageService.getThreadMessages(parentMessageId);
      socket.emit('thread_messages', {
        parentMessageId,
        messages
      });
    } catch (error) {
      console.error('Error fetching thread messages:', error);
      socket.emit('error', 'Failed to fetch thread messages');
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Add file upload endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      throw new Error('No file uploaded');
    }

    console.log('File received:', {
      filename: req.file.originalname,
      path: req.file.path,
      size: req.file.size
    });

    // Verify the file exists in the upload directory
    if (!fs.existsSync(req.file.path)) {
      throw new Error('File was not saved properly');
    }

    // Read the file from disk
    const fileContent = await fs.promises.readFile(req.file.path);
    console.log('File read from disk, size:', fileContent.length);

    // Verify file content
    if (!fileContent || fileContent.length === 0) {
      throw new Error('File content is empty');
    }

    const fileData = {
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      fileContent: fileContent
    };

    // Process file (save another copy locally and upload to S3)
    const uploadData = await s3Service.getUploadPresignedUrl(fileData);
    
    // Send file to RAG service for processing
    const formData = new FormData();
    formData.append('file', fileContent, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
      knownLength: req.file.size
    });

    try {
      const ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://rag_app:8001';
      const ragResponse = await fetch(`${ragServiceUrl}/process`, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders()
      });

      if (!ragResponse.ok) {
        console.error('RAG processing failed:', await ragResponse.text());
      } else {
        console.log('RAG processing successful:', await ragResponse.json());
      }
    } catch (ragError) {
      console.error('Error sending to RAG service:', ragError);
      // Don't throw here, we still want to return the upload success
    }

    // Verify both files exist
    const multerFilePath = req.file.path;
    const s3ServiceFilePath = uploadData.localPath;
    
    if (!fs.existsSync(multerFilePath)) {
      console.error('Multer file not found at:', multerFilePath);
    }
    if (!fs.existsSync(s3ServiceFilePath)) {
      console.error('S3 service file not found at:', s3ServiceFilePath);
    }

    console.log('File processing complete:', {
      multerPath: multerFilePath,
      s3ServicePath: s3ServiceFilePath,
      s3Key: uploadData.key
    });

    res.json({
      ...uploadData,
      message: 'File uploaded and saved successfully'
    });
  } catch (error) {
    console.error('Error handling file upload:', error);
    res.status(500).json({ error: `Failed to handle file upload: ${(error as Error).message}` });
  }
});

// Add route to list uploaded files
app.get('/uploads', async (req, res) => {
  try {
    const files = await fs.promises.readdir(UPLOAD_DIR);
    const fileDetails = await Promise.all(
      files.map(async (filename) => {
        const filePath = path.join(UPLOAD_DIR, filename);
        const stats = await fs.promises.stat(filePath);
        return {
          name: filename,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
    );
    res.json(fileDetails);
  } catch (error) {
    console.error('Error listing uploads:', error);
    res.status(500).json({ error: 'Failed to list uploads' });
  }
});

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});