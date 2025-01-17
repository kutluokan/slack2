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
          "#photo": "photoURL"
        },
        ProjectionExpression: "messageId, channelId, #ts, #uid, #content, #uname, #isAI, #photo, reactions",
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
    
    // Update or create the reaction array for this emoji
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
      
      // Format messages for OpenAI, including metadata for better context
      const formattedMessages = contextMessages.map(msg => ({
        role: msg.isAIResponse ? 'assistant' as const : 'user' as const,
        content: `${msg.username}: ${msg.content}`,  // Include username in content for better context
      }));

      // Add the trigger message if it's not already included
      const isTriggerMessageIncluded = contextMessages.find(msg => msg.messageId === triggerMessage.messageId);
      if (!isTriggerMessageIncluded) {
        formattedMessages.push({
          role: 'user' as const,
          content: `${triggerMessage.username}: ${triggerMessage.content}`
        });
      }

      console.log('AI Context:', {
        channelId,
        messageCount: formattedMessages.length,
        timeRange: contextMessages.length > 0 ? {
          start: new Date(contextMessages[0].timestamp).toISOString(),
          end: new Date(contextMessages[contextMessages.length - 1].timestamp).toISOString()
        } : null,
        messages: formattedMessages.map(m => ({
          role: m.role,
          contentLength: m.content.length
        }))
      });

      // Get AI response
      const aiResponse = await aiService.generateResponse(formattedMessages);

      console.log('Received AI response length:', aiResponse.length);

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
      console.log('AI response created:', {
        messageId: createdMessage.messageId,
        timestamp: createdMessage.timestamp,
        contentLength: createdMessage.content.length
      });

      return createdMessage;
    } catch (error) {
      console.error('Error handling AI interaction:', error);
      throw error;
    }
  },
}; 