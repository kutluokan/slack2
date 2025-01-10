import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../config/dynamodb";

const TABLE_NAME = "K_Threads";

export interface ThreadMessage {
  threadId: string;
  messageId: string;
  parentMessageId: string;
  content: string;
  userId: string;
  username: string;
  timestamp: number;
}

export const threadService = {
  async createThreadMessage(message: Omit<ThreadMessage, 'timestamp'>) {
    const threadMessage: ThreadMessage = {
      ...message,
      timestamp: Date.now(),
    };

    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: threadMessage,
    });

    await docClient.send(command);
    return threadMessage;
  },

  async getThreadMessages(threadId: string) {
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "threadId = :threadId",
      ExpressionAttributeValues: {
        ":threadId": threadId,
      },
      ScanIndexForward: true,
    });

    const response = await docClient.send(command);
    return response.Items as ThreadMessage[];
  }
}; 