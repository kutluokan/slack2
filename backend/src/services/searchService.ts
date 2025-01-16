import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../config/dynamodb";
import { Message } from "./messageService";
import { channelService } from "./channelService";
import { userService } from "./userService";

const MESSAGES_TABLE = "K_Messages";

export const searchService = {
  async searchMessages(query: string, userId?: string): Promise<Message[]> {
    try {
      const lowercaseQuery = query.toLowerCase();
      let allMessages: Message[] = [];

      // Get all regular channels and DM channels
      const [channels, dmChannels] = await Promise.all([
        channelService.getAllChannels(),
        userId ? channelService.getUserDMChannels(userId) : []
      ]);

      // Create a map for DM channel names
      const dmChannelNames = new Map();
      for (const channel of dmChannels) {
        if (channel.participants) {
          const otherUserId = channel.participants.find(id => id !== userId);
          if (otherUserId) {
            const user = await userService.getUser(otherUserId);
            dmChannelNames.set(channel.channelId, user?.displayName || user?.email || otherUserId);
          }
        }
      }

      // Combine all channels and create channel map
      const allChannels = [...channels, ...dmChannels];
      const channelMap = new Map(allChannels.map(channel => [
        channel.channelId,
        channel.isDM ? dmChannelNames.get(channel.channelId) : channel.name
      ]));

      // Fetch messages from each channel
      for (const channel of allChannels) {
        const command = new ScanCommand({
          TableName: MESSAGES_TABLE,
          FilterExpression: "channelId = :channelId",
          ExpressionAttributeValues: {
            ":channelId": channel.channelId
          }
        });

        const response = await docClient.send(command);
        if (response.Items) {
          const messagesWithChannel = response.Items.map(message => ({
            ...message,
            channelName: channelMap.get(message.channelId) || message.channelId
          }));
          allMessages = [...allMessages, ...(messagesWithChannel as Message[])];
        }
      }

      // Filter messages based on content or file name
      const filteredMessages = allMessages.filter(message => {
        const contentMatch = message.content.toLowerCase().includes(lowercaseQuery);
        let fileMatch = false;
        if (message.fileAttachment) {
          const fileName = message.fileAttachment.fileName.toLowerCase();
          fileMatch = fileName.includes(lowercaseQuery);
        }
        return contentMatch || fileMatch;
      });

      return filteredMessages
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 50);
    } catch (error) {
      console.error('Error searching messages:', error);
      throw error;
    }
  }
}; 