import { PutCommand, QueryCommand, DeleteCommand, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../config/dynamodb";
import { aiService } from "./aiService";

const TABLE_NAME = "K_Messages";

export interface Message {
  messageId: string;
  channelId: string;
  timestamp: number;
  userId: string;
  content: string;
  username: string;
  photoURL?: string;
  channelName?: string;
  reactions?: { [key: string]: string[] };
  isAIResponse?: boolean;
  parentMessageId?: string;
  threadMessageCount?: number;
  fileAttachment?: {
    fileName: string;
    fileType: string;
    fileSize: number;
    fileUrl: string;
    s3Key: string;
  };
}

export const messageService = {
  async createMessage(message: Message) {
    const messageId = `${message.channelId}#${message.timestamp}`;
    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        messageId,
        channelId: message.channelId,
        timestamp: message.timestamp,
        userId: message.userId,
        content: message.content,
        username: message.username,
        photoURL: message.photoURL,
        reactions: {},
        isAIResponse: message.isAIResponse || false,
        fileAttachment: message.fileAttachment || undefined,
        parentMessageId: message.parentMessageId || undefined,
        ...(message.threadMessageCount !== undefined && { threadMessageCount: message.threadMessageCount }),
      },
    });

    await docClient.send(command);

    // If this is a thread reply, update the parent message's thread count
    if (message.parentMessageId) {
      await this.incrementThreadMessageCount(message.parentMessageId);
    }

    return { ...message, messageId };
  },

  async incrementThreadMessageCount(messageId: string) {
    const command = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { messageId },
      UpdateExpression: 'SET threadMessageCount = if_not_exists(threadMessageCount, :zero) + :one',
      ExpressionAttributeValues: {
        ':zero': 0,
        ':one': 1
      },
      ReturnValues: 'ALL_NEW'
    });

    await docClient.send(command);
  },

  async getChannelMessages(channelId: string) {
    try {
      console.log(`Fetching messages for channel: ${channelId}`);
      
      const command = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "ChannelIndex",
        KeyConditionExpression: "channelId = :channelId",
        ExpressionAttributeValues: {
          ":channelId": channelId,
        },
        ExpressionAttributeNames: {
          "#ts": "timestamp",
          "#content": "content",
          "#uid": "userId",
          "#uname": "username",
          "#isAI": "isAIResponse",
          "#photo": "photoURL",
          "#file": "fileAttachment"
        },
        ProjectionExpression: "messageId, channelId, #ts, #uid, #content, #uname, #isAI, #photo, reactions, #file",
        ScanIndexForward: false,  // Get newest messages first
        Limit: 100  // Increased limit for better context
      });

      console.log('Query command:', JSON.stringify(command.input, null, 2));
      
      const response = await docClient.send(command);
      
      console.log('Raw DynamoDB response:', JSON.stringify(response, null, 2));
      console.log(`Retrieved ${response.Items?.length || 0} messages`);
      
      if (!response.Items || response.Items.length === 0) {
        console.log('No messages found for channel');
        return [];
      }

      // Sort messages by timestamp to ensure correct order
      const messages = response.Items as Message[];
      messages.sort((a, b) => a.timestamp - b.timestamp);

      console.log('Sorted messages timestamps:', messages.map(m => ({
        messageId: m.messageId,
        timestamp: m.timestamp,
        username: m.username,
        isAI: m.isAIResponse
      })));

      return messages;
    } catch (error: any) {
      console.error('Error fetching channel messages:', {
        error: error.message,
        name: error.name,
        channelId,
        time: new Date().toISOString(),
        code: error.code,
        statusCode: error.$metadata?.httpStatusCode,
        details: error.toString()
      });
      throw error;
    }
  },

  async getThreadMessages(parentMessageId: string) {
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "ThreadIndex",
      KeyConditionExpression: "parentMessageId = :parentMessageId",
      ExpressionAttributeValues: {
        ":parentMessageId": parentMessageId,
      },
      ScanIndexForward: true,
    });

    const response = await docClient.send(command);
    return response.Items as Message[];
  },

  async deleteMessage(messageId: string) {
    const command = new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        messageId
      }
    });

    await docClient.send(command);
    return { messageId };
  },

  async addReaction(messageId: string, emoji: string, userId: string) {
    if (!messageId || !emoji || !userId) {
      throw new Error('Missing required reaction parameters');
    }

    // Get the current message
    const getMessage = new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        messageId
      }
    });

    const currentMessage = await docClient.send(getMessage);
    if (!currentMessage.Item) {
      throw new Error('Message not found');
    }

    const currentReactions = currentMessage.Item.reactions || {};
    
    // Check if user already reacted with this emoji
    if (currentReactions[emoji]?.includes(userId)) {
      // If user already reacted, remove their reaction
      const updatedReactions = {
        ...currentReactions,
        [emoji]: currentReactions[emoji].filter((id: string) => id !== userId)
      };

      // Remove the emoji key if no users are left
      if (updatedReactions[emoji].length === 0) {
        delete updatedReactions[emoji];
      }

      const command = new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          messageId
        },
        UpdateExpression: 'SET reactions = :reactions',
        ExpressionAttributeValues: {
          ':reactions': updatedReactions
        },
        ReturnValues: 'ALL_NEW'
      });

      const response = await docClient.send(command);
      return { 
        messageId, 
        emoji, 
        reactions: response.Attributes?.reactions || {} 
      };
    }
    
    // If user hasn't reacted, add their reaction
    const updatedReactions = {
      ...currentReactions,
      [emoji]: currentReactions[emoji] 
        ? Array.from(new Set([...currentReactions[emoji], userId]))
        : [userId]
    };

    const command = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        messageId
      },
      UpdateExpression: 'SET reactions = :reactions',
      ExpressionAttributeValues: {
        ':reactions': updatedReactions
      },
      ReturnValues: 'ALL_NEW'
    });

    const response = await docClient.send(command);
    return { 
      messageId, 
      emoji, 
      reactions: response.Attributes?.reactions || {} 
    };
  },

  async getMessage(messageId: string) {
    const command = new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        messageId
      }
    });

    const response = await docClient.send(command);
    return response.Item as Message;
  },

  async handleAIInteraction(channelId: string, messages: Message[], triggerMessage: Message) {
    try {
      console.log(`Handling AI interaction for channel: ${channelId}`);
      
      // Determine if this is a DM with Elon or AI Assistant
      const isDMWithElon = channelId.startsWith('dm_') && channelId.includes('elon-musk-ai');
      const isDMWithAI = channelId.startsWith('dm_') && channelId.includes('ai-assistant');
      
      // Check if message mentions Elon in a channel
      const mentionsElon = !channelId.startsWith('dm_') && 
        triggerMessage.content.toLowerCase().includes('@elon');

      // If this is a DM with Elon or mentions Elon in a channel
      if (isDMWithElon || mentionsElon) {
        return this.handleElonResponse(channelId, messages, triggerMessage);
      }

      // If this is a DM with AI Assistant
      if (isDMWithAI) {
        return this.handleAIAssistantResponse(channelId, messages, triggerMessage);
      }

      // Original AI Assistant logic for channels
      console.log('Initial messages count:', messages.length);
      console.log('Trigger message:', {
        id: triggerMessage.messageId,
        content: triggerMessage.content,
        username: triggerMessage.username
      });
      
      // Ensure messages are in chronological order
      const orderedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);
      
      // Take the last 25 messages for better context
      const contextMessages = orderedMessages.slice(-25);
      
      console.log('Context messages:', contextMessages.map(m => ({
        messageId: m.messageId,
        timestamp: m.timestamp,
        username: m.username,
        content: m.content.substring(0, 50) + (m.content.length > 50 ? '...' : ''),
        isAI: m.isAIResponse
      })));

      // Format messages for OpenAI
      const formattedMessages = contextMessages.map(msg => ({
        role: msg.isAIResponse ? 'assistant' as const : 'user' as const,
        content: `${msg.username}: ${msg.content}`,
      }));

      // Add the trigger message if it's not already included
      const isTriggerMessageIncluded = contextMessages.find(msg => msg.messageId === triggerMessage.messageId);
      if (!isTriggerMessageIncluded) {
        formattedMessages.push({
          role: 'user' as const,
          content: `${triggerMessage.username}: ${triggerMessage.content}`
        });
      }

      // Get AI response
      const aiResponse = await aiService.generateResponse(formattedMessages);

      // Create AI message
      const aiMessage: Message = {
        channelId,
        timestamp: Date.now(),
        userId: 'ai-assistant',
        content: aiResponse,
        username: 'AI Assistant',
        isAIResponse: true,
        messageId: '', // Will be set in createMessage
      };

      const createdMessage = await this.createMessage(aiMessage);
      return createdMessage;
    } catch (error) {
      console.error('Error handling AI interaction:', error);
      throw error;
    }
  },

  async handleAIAssistantResponse(channelId: string, messages: Message[], triggerMessage: Message) {
    try {
      // Ensure messages are in chronological order
      const orderedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);
      
      // Take the last 25 messages for context
      const contextMessages = orderedMessages.slice(-25);
      
      // Format messages for OpenAI
      const formattedMessages = contextMessages.map(msg => ({
        role: msg.isAIResponse ? 'assistant' as const : 'user' as const,
        content: msg.content
      }));

      // Add the trigger message if it's not already included
      const isTriggerMessageIncluded = contextMessages.find(msg => msg.messageId === triggerMessage.messageId);
      if (!isTriggerMessageIncluded) {
        formattedMessages.push({
          role: 'user' as const,
          content: triggerMessage.content
        });
      }

      // Get AI response using RAG
      const aiResponse = await aiService.generateResponse(formattedMessages);

      // Create AI message
      const aiMessage: Message = {
        channelId,
        timestamp: Date.now(),
        userId: 'ai-assistant',
        content: aiResponse,
        username: 'AI Assistant',
        photoURL: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/HONDA_ASIMO.jpg/640px-HONDA_ASIMO.jpg',
        isAIResponse: true,
        messageId: '', // Will be set in createMessage
      };

      const createdMessage = await this.createMessage(aiMessage);
      return createdMessage;
    } catch (error) {
      console.error('Error handling AI Assistant response:', error);
      throw error;
    }
  },

  async handleElonResponse(channelId: string, messages: Message[], triggerMessage: Message) {
    try {
      // Ensure messages are in chronological order
      const orderedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);
      
      // Take the last 25 messages for context
      const contextMessages = orderedMessages.slice(-25);
      
      // Format messages for OpenAI with special system prompt for Elon's personality
      const formattedMessages = [
        {
          role: 'system' as const,
          content: `You are Elon Musk. Respond in his characteristic style - direct, technical, sometimes humorous, and occasionally controversial. 
                   Focus on topics like technology, innovation, space exploration, electric vehicles, and artificial intelligence.
                   Never start responses with 'Assistant:' or similar prefixes. Just respond directly as Elon would.
                   Keep responses concise and impactful, often with a hint of wit or sarcasm.`
        },
        ...contextMessages.map(msg => ({
          role: msg.isAIResponse ? 'assistant' as const : 'user' as const,
          content: msg.content
        }))
      ];

      // Add the trigger message if it's not already included
      const isTriggerMessageIncluded = contextMessages.find(msg => msg.messageId === triggerMessage.messageId);
      if (!isTriggerMessageIncluded) {
        formattedMessages.push({
          role: 'user' as const,
          content: triggerMessage.content
        });
      }

      // Get Elon's response
      const elonResponse = await aiService.generateResponse(formattedMessages);

      // Create Elon's message
      const elonMessage: Message = {
        channelId,
        timestamp: Date.now(),
        userId: 'elon-musk-ai',
        content: elonResponse,
        username: 'Elon Musk',
        photoURL: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Elon_Musk_Royal_Society_crop.jpg/800px-Elon_Musk_Royal_Society_crop.jpg',
        isAIResponse: true,
        messageId: '', // Will be set in createMessage
      };

      const createdMessage = await this.createMessage(elonMessage);
      return createdMessage;
    } catch (error) {
      console.error('Error handling Elon response:', error);
      throw error;
    }
  }
}; 