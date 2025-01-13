import { PutCommand, QueryCommand, DeleteCommand, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../config/dynamodb";

const TABLE_NAME = "K_Messages";

export interface Message {
  messageId: string;
  channelId: string;
  timestamp: number;
  userId: string;
  content: string;
  username: string;
  reactions?: { [key: string]: string[] };
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
        reactions: {}
      },
    });

    await docClient.send(command);
    return { ...message, messageId };
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

  async deleteMessage(messageId: string) {
    const command = new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        messageId
      },
    });

    await docClient.send(command);
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
  }
}; 