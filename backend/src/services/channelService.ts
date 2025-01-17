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
      console.log('Fetching all channels');
      
      const command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'attribute_not_exists(isDM) OR isDM = :isDM',
        ExpressionAttributeValues: {
          ':isDM': false
        },
        ConsistentRead: true  // Added to ensure consistency
      });

      console.log('Scan command:', JSON.stringify(command.input, null, 2));
      
      const response = await docClient.send(command);
      
      console.log(`Retrieved ${response.Items?.length || 0} channels`);
      
      if (!response.Items || response.Items.length === 0) {
        console.log('No channels found');
        return [];
      }

      // Sort channels by creation time
      const channels = response.Items as Channel[];
      channels.sort((a, b) => b.createdAt - a.createdAt);

      return channels;
    } catch (error: any) {
      console.error('Error getting all channels:', {
        error: error.message,
        name: error.name,
        time: new Date().toISOString(),
        code: error.code,
        statusCode: error.$metadata?.httpStatusCode,
      });
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