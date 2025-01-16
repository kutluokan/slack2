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
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "ChannelIndex",
      KeyConditionExpression: "channelId = :channelId",
      ExpressionAttributeValues: {
        ":channelId": channelId,
      },
      ScanIndexForward: false,
      Limit: 50,
    });

    const response = await docClient.send(command);
    return response.Items as Message[];
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
      // Format messages for OpenAI
      const formattedMessages = messages.map(msg => ({
        role: msg.isAIResponse ? 'assistant' as const : 'user' as const,
        content: msg.content
      }));

      // Add the trigger message
      formattedMessages.push({
        role: 'user' as const,
        content: triggerMessage.content
      });

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

      return await this.createMessage(aiMessage);
    } catch (error) {
      console.error('Error handling AI interaction:', error);
      throw error;
    }
  },
}; 