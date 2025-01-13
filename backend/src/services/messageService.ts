import { PutCommand, QueryCommand, DeleteCommand, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../config/dynamodb";

const TABLE_NAME = "K_Messages";

export interface Message {
  channelId: string;
  timestamp: number;
  userId: string;
  content: string;
  username: string;
  reactions?: { [key: string]: string[] };
}

export const messageService = {
  async createMessage(message: Message) {
    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...message,
        messageId: `${message.channelId}#${message.timestamp}`,
      },
    });

    await docClient.send(command);
    return message;
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

  async deleteMessage(channelId: string, timestamp: number) {
    const command = new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        channelId,
        timestamp,
      },
    });

    await docClient.send(command);
  },

  async addReaction(messageId: string, emoji: string, userId: string) {
    if (!messageId || !emoji || !userId) {
      throw new Error('Missing required reaction parameters');
    }

    const [channelId, timestamp] = messageId.split('#');
    
    if (!channelId || !timestamp) {
      throw new Error('Invalid message ID format');
    }

    // First get the current message to check existing reactions
    const getMessage = new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        channelId,
        timestamp: parseInt(timestamp)
      }
    });

    const currentMessage = await docClient.send(getMessage);
    const currentReactions = currentMessage.Item?.reactions || {};
    
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
        channelId,
        timestamp: parseInt(timestamp)
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
    const [channelId, timestamp] = messageId.split('#');
    
    const command = new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        channelId,
        timestamp: parseInt(timestamp)
      }
    });

    const response = await docClient.send(command);
    return response.Item as Message;
  }
}; 