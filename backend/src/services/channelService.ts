import { PutCommand, ScanCommand, DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../config/dynamodb";

const TABLE_NAME = "K_Channels";

export interface Channel {
  channelId: string;
  name: string;
  createdBy: string;
  createdAt: number;
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
        TableName: TABLE_NAME
      });

      const response = await docClient.send(command);
      return response.Items as Channel[];
    } catch (error) {
      console.error('Error getting all channels:', error);
      throw error;
    }
  }
}; 