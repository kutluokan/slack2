import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../config/dynamodb";
import { Message } from "./messageService";

const MESSAGES_TABLE = "K_Messages";

export const searchService = {
  async searchMessages(query: string): Promise<Message[]> {
    try {
      // Convert query to lowercase for case-insensitive search
      const lowercaseQuery = query.toLowerCase();

      // Use scan to get all messages across all channels
      const command = new ScanCommand({
        TableName: MESSAGES_TABLE,
        Limit: 50, // Limit to 50 results for performance
      });

      const response = await docClient.send(command);
      const messages = response.Items as Message[];

      // Filter messages based on content or file name
      const filteredMessages = messages.filter(message => {
        const contentMatch = message.content.toLowerCase().includes(lowercaseQuery);
        const fileMatch = message.fileAttachment?.fileName?.toLowerCase().includes(lowercaseQuery);
        return contentMatch || fileMatch;
      });

      // Sort by timestamp, newest first
      return filteredMessages.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Error searching messages:', error);
      throw error;
    }
  }
}; 