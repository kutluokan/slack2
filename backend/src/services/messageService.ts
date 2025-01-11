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
    const message = await this.getMessage(messageId);
    if (!message) throw new Error('Message not found');

    const reactions = message.reactions || {};
    const existingReactions = reactions[emoji] || [];
    
    // Toggle reaction
    const newReactions = existingReactions.includes(userId)
      ? existingReactions.filter(id => id !== userId)
      : [...existingReactions, userId];

    const command = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        messageId,
        channelId: message.channelId
      },
      UpdateExpression: 'SET reactions.#emoji = :users',
      ExpressionAttributeNames: {
        '#emoji': emoji
      },
      ExpressionAttributeValues: {
        ':users': newReactions
      }
    });

    await docClient.send(command);
    return { messageId, emoji, reactions: { [emoji]: newReactions } };
  },

  async getMessage(messageId: string) {
    const command = new GetCommand({
      TableName: TABLE_NAME,
      Key: { messageId }
    });

    const response = await docClient.send(command);
    return response.Item as Message;
  }
}; 