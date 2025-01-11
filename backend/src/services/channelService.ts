import { PutCommand, ScanCommand, DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../config/dynamodb";

const TABLE_NAME = "K_Channels";

export interface Channel {
  channelId: string;
  name: string;
  createdBy: string;
  createdAt: number;
  isPrivate: boolean;
  members: string[];
}

export const channelService = {
  async createChannel(channel: Omit<Channel, 'channelId' | 'createdAt'>) {
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
  },

  async getChannel(channelId: string) {
    const command = new GetCommand({
      TableName: TABLE_NAME,
      Key: { channelId },
    });

    const response = await docClient.send(command);
    return response.Item as Channel;
  },

  async getUserChannels(userId: string) {
    const command = new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: "contains(members, :userId)",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    });

    const response = await docClient.send(command);
    return response.Items as Channel[];
  }
}; 