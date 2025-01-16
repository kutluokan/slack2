import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../config/dynamodb";
import { Message } from "./messageService";
import { channelService } from "./channelService";

const MESSAGES_TABLE = "K_Messages";

export const searchService = {
  async searchMessages(query: string): Promise<Message[]> {
    try {
      // Convert query to lowercase for case-insensitive search
      const lowercaseQuery = query.toLowerCase();

      // Get all channels first
      const channels = await channelService.getAllChannels();
      let allMessages: Message[] = [];

      // Fetch messages from each channel
      for (const channel of channels) {
        const command = new ScanCommand({
          TableName: MESSAGES_TABLE,
          FilterExpression: "channelId = :channelId",
          ExpressionAttributeValues: {
            ":channelId": channel.channelId
          }
        });

        const response = await docClient.send(command);
        if (response.Items) {
          allMessages = [...allMessages, ...(response.Items as Message[])];
        }
      }

      // Filter messages based on content or file name
      const filteredMessages = allMessages.filter(message => {
        // Check message content
        const contentMatch = message.content.toLowerCase().includes(lowercaseQuery);
        
        // Check file attachment
        let fileMatch = false;
        if (message.fileAttachment) {
          const fileName = message.fileAttachment.fileName.toLowerCase();
          fileMatch = fileName.includes(lowercaseQuery);
        }

        return contentMatch || fileMatch;
      });

      // Sort by timestamp, newest first
      return filteredMessages
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 50); // Limit to 50 most recent results
    } catch (error) {
      console.error('Error searching messages:', error);
      throw error;
    }
  }
}; 