import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../config/dynamodb";

const TABLE_NAME = "K_DirectMessages";

export interface DirectMessage {
  dmId: string;
  participants: string[];
  lastMessageAt: number;
  createdAt: number;
}

export const dmService = {
  async createOrGetDM(participants: string[]) {
    // Sort participants to ensure consistent ID generation
    const sortedParticipants = [...participants].sort();
    const dmId = `dm_${sortedParticipants.join('_')}`;

    // Try to get existing DM
    const getCommand = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "dmId = :dmId",
      ExpressionAttributeValues: {
        ":dmId": dmId,
      },
    });

    const existing = await docClient.send(getCommand);
    if (existing.Items && existing.Items.length > 0) {
      return existing.Items[0] as DirectMessage;
    }

    // Create new DM if it doesn't exist
    const newDM: DirectMessage = {
      dmId,
      participants: sortedParticipants,
      lastMessageAt: Date.now(),
      createdAt: Date.now(),
    };

    const createCommand = new PutCommand({
      TableName: TABLE_NAME,
      Item: newDM,
    });

    await docClient.send(createCommand);
    return newDM;
  },

  async getUserDMs(userId: string) {
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "ParticipantIndex",
      KeyConditionExpression: "contains(participants, :userId)",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    });

    const response = await docClient.send(command);
    return response.Items as DirectMessage[];
  }
}; 