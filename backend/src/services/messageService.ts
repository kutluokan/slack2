import { PutCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../config/dynamodb";

const TABLE_NAME = "K_Messages";

export interface Message {
  channelId: string;
  timestamp: number;
  userId: string;
  content: string;
  username: string;
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
  }
}; 