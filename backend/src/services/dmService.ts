import { PutCommand, ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../config/dynamodb";
import { Channel } from "./channelService";
import { userService } from "./userService";

const CHANNELS_TABLE = "K_Channels";

export const dmService = {
  async createOrGetDM(participants: string[]) {
    // Sort participants to ensure consistent ID generation
    const sortedParticipants = [...participants].sort();
    const channelId = `dm_${sortedParticipants.join('_')}`;

    // Try to get existing DM channel
    const getCommand = new GetCommand({
      TableName: CHANNELS_TABLE,
      Key: { channelId },
    });

    const response = await docClient.send(getCommand);
    if (response.Item) {
      return response.Item as Channel;
    }

    // Create new DM channel if it doesn't exist
    const newChannel: Channel = {
      channelId,
      name: `dm_${sortedParticipants[0]}_${sortedParticipants[1]}`,
      createdBy: participants[0],
      createdAt: Date.now(),
      isDM: true,
      participants: sortedParticipants,
    };

    const command = new PutCommand({
      TableName: CHANNELS_TABLE,
      Item: newChannel,
    });

    await docClient.send(command);
    return newChannel;
  },

  async getUserDMChannels(userId: string) {
    try {
      const command = new ScanCommand({
        TableName: CHANNELS_TABLE,
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

  async getDMChannelName(channelId: string, currentUserId: string): Promise<string> {
    try {
      const command = new GetCommand({
        TableName: CHANNELS_TABLE,
        Key: { channelId },
      });

      const response = await docClient.send(command);
      const channel = response.Item as Channel;

      if (!channel || !channel.isDM || !channel.participants) {
        return channelId;
      }

      const otherUserId = channel.participants.find(id => id !== currentUserId);
      if (!otherUserId) {
        return channelId;
      }

      const user = await userService.getUser(otherUserId);
      return user?.displayName || user?.email || otherUserId;
    } catch (error) {
      console.error('Error getting DM channel name:', error);
      return channelId;
    }
  }
}; 