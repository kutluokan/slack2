import { PutCommand, ScanCommand, DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../config/dynamodb";
import { messageService } from "./messageService";

const TABLE_NAME = "K_Channels";

export interface Channel {
  channelId: string;
  name: string;
  createdBy: string;
  createdAt: number;
  isDM?: boolean;
  participants?: string[];  // For DM channels, this will contain the two user IDs
}

export const channelService = {
  async createChannel(channel: Omit<Channel, 'channelId' | 'createdAt'>) {
    try {
      const newChannel: Channel = {
        ...channel,
        channelId: `channel_${Date.now()}`,
        createdAt: Date.now(),
      };

      const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: newChannel,
      });

      await docClient.send(command);
      return newChannel;
    } catch (error) {
      console.error('Error creating channel:', error);
      throw error;
    }
  },

  async getChannel(channelId: string) {
    try {
      const command = new GetCommand({
        TableName: TABLE_NAME,
        Key: { channelId },
      });

      const response = await docClient.send(command);
      return response.Item as Channel;
    } catch (error) {
      console.error('Error getting channel:', error);
      throw error;
    }
  },


  async getAllChannels() {
    try {
      const command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'attribute_not_exists(isDM) OR isDM = :isDM',
        ExpressionAttributeValues: {
          ':isDM': false
        }
      });

      const response = await docClient.send(command);
      return response.Items as Channel[];
    } catch (error) {
      console.error('Error getting all channels:', error);
      throw error;
    }
  },

  async createDMChannel(user1Id: string, user2Id: string) {
    try {
      const participants = [user1Id, user2Id].sort(); // Sort to ensure consistent channel IDs
      const channelId = `dm_${participants.join('_')}`;
      
      // Check if DM channel already exists
      const existingChannel = await this.getChannel(channelId);
      if (existingChannel) {
        return existingChannel;
      }

      const newChannel: Channel = {
        channelId,
        name: `dm_${participants[0]}_${participants[1]}`,
        createdBy: user1Id,
        createdAt: Date.now(),
        isDM: true,
        participants,
      };

      const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: newChannel,
      });

      await docClient.send(command);
      return newChannel;
    } catch (error) {
      console.error('Error creating DM channel:', error);
      throw error;
    }
  },

  async getUserDMChannels(userId: string) {
    try {
      const command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'isDM = :isDM AND contains(participants, :userId)',
        ExpressionAttributeValues: {
          ':isDM': true,
          ':userId': userId,
        },
      });

      const response = await docClient.send(command);
      return response.Items as Channel[];
    } catch (error) {
      console.error('Error getting user DM channels:', error);
      throw error;
    }
  },

  async deleteChannel(channelId: string) {
    try {
      // Delete the channel
      const deleteCommand = new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { channelId },
      });

      await docClient.send(deleteCommand);

      // Delete all messages in the channel
      const messages = await messageService.getChannelMessages(channelId);
      for (const message of messages) {
        await messageService.deleteMessage(message.messageId);
      }

      return true;
    } catch (error) {
      console.error('Error deleting channel:', error);
      throw error;
    }
  }
}; 