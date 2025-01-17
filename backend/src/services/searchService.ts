import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../config/dynamodb";
import { Message } from "./messageService";
import { channelService } from "./channelService";
import { dmService } from "./dmService";

const MESSAGES_TABLE = "K_Messages";

export const searchService = {
  async searchMessages(query: string, userId?: string): Promise<Message[]> {
    try {
      const lowercaseQuery = query.toLowerCase();

      // First get all messages (we'll filter them in memory for case-insensitive search)
      const command = new ScanCommand({
        TableName: MESSAGES_TABLE
      });

      const response = await docClient.send(command);
      const allMessages = (response.Items || []) as Message[];
      
      // Filter messages that match the query (case-insensitive)
      const messages = allMessages.filter(message => {
        const contentMatch = message.content?.toLowerCase().includes(lowercaseQuery);
        const fileMatch = message.fileAttachment?.fileName?.toLowerCase().includes(lowercaseQuery);
        return contentMatch || fileMatch;
      });

      if (!userId) {
        return messages
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 50);
      }

      // Get channel access information after finding messages
      const uniqueChannelIds = new Set(messages.map(m => m.channelId).filter(Boolean));
      const dmChannelIds = new Set<string>();
      const regularChannelIds = new Set<string>();

      // Categorize channels and check access
      for (const channelId of uniqueChannelIds) {
        if (channelId.startsWith('dm_')) {
          dmChannelIds.add(channelId);
        } else {
          regularChannelIds.add(channelId);
        }
      }

      // Get regular channels
      const channels = await channelService.getAllChannels();
      const accessibleRegularChannels = new Set(
        channels.map(c => c.channelId)
      );

      // For DM channels, verify access for each
      const dmAccessPromises = Array.from(dmChannelIds).map(async channelId => {
        try {
          const channel = await channelService.getChannel(channelId);
          // Check if the user is a participant in the DM
          if (channel?.participants?.includes(userId)) {
            return channelId;
          }
        } catch (error) {
          console.error(`Error checking DM access for channel ${channelId}:`, error);
        }
        return null;
      });

      const accessibleDmChannels = new Set(
        (await Promise.all(dmAccessPromises))
          .filter((channelId): channelId is string => channelId !== null)
      );

      // Combine accessible channels
      const accessibleChannelIds = new Set([
        ...accessibleRegularChannels,
        ...accessibleDmChannels
      ]);

      // Get channel names for accessible channels
      const channelNames = new Map<string, string>();
      for (const channelId of accessibleChannelIds) {
        if (channelId.startsWith('dm_')) {
          const channelName = await dmService.getDMChannelName(channelId, userId);
          channelNames.set(channelId, channelName);
        } else {
          const channel = channels.find(c => c.channelId === channelId);
          if (channel) {
            channelNames.set(channelId, channel.name);
          }
        }
      }

      // Filter messages and add channel names
      const filteredMessages = messages
        .filter(message => message.channelId && accessibleChannelIds.has(message.channelId))
        .map(message => ({
          ...message,
          channelName: channelNames.get(message.channelId) || message.channelId
        }));

      return filteredMessages
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 50);
    } catch (error) {
      console.error('Error searching messages:', error);
      throw error;
    }
  }
}; 