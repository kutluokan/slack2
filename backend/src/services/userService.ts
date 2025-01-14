import { PutCommand, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../config/dynamodb";

const TABLE_NAME = "K_Users";

const AI_USER = {
  userId: 'ai-assistant',
  email: 'ai@system.local',
  displayName: 'AI Assistant',
  photoURL: '/ai-avatar.png',
  isSystemUser: true,
  createdAt: Date.now(),
  lastLogin: Date.now(),
};

export interface User {
  userId: string;
  email: string;
  displayName: string;
  photoURL?: string;
  isSystemUser?: boolean;
  createdAt: number;
  lastLogin: number;
}

export const userService = {
  async createOrUpdateUser(userData: { userId: string; email: string | null; displayName: string | null; photoURL?: string | null }) {
    try {
      const now = Date.now();
      
      // First try to get existing user
      const getCommand = new GetCommand({
        TableName: TABLE_NAME,
        Key: { userId: userData.userId },
      });

      let existingUser;
      try {
        const response = await docClient.send(getCommand);
        existingUser = response.Item as User;
      } catch (error) {
        console.error('Error fetching existing user:', error);
        // Continue with creation if user doesn't exist
      }

      const user: User = {
        userId: userData.userId,
        email: userData.email || (existingUser?.email || ''),
        displayName: userData.displayName || (existingUser?.displayName || 'Anonymous'),
        photoURL: userData.photoURL || existingUser?.photoURL,
        createdAt: existingUser ? existingUser.createdAt : now,
        lastLogin: now,
      };

      // Only update if there are actual changes
      if (!existingUser || 
          userData.email !== null || 
          userData.displayName !== null || 
          userData.photoURL !== null) {
        const command = new PutCommand({
          TableName: TABLE_NAME,
          Item: user,
        });

        await docClient.send(command);
        console.log('User successfully created/updated:', user.userId);
      }

      return user;
    } catch (error) {
      console.error('Error in createOrUpdateUser:', error);
      throw new Error(`Failed to create/update user: ${(error as Error).message}`);
    }
  },

  async getUser(userId: string) {
    try {
      const command = new GetCommand({
        TableName: TABLE_NAME,
        Key: { userId },
      });

      const response = await docClient.send(command);
      return response.Item as User;
    } catch (error) {
      console.error('Error in getUser:', error);
      throw new Error(`Failed to get user: ${(error as Error).message}`);
    }
  },

  async getAllUsers() {
    try {
      const command = new ScanCommand({
        TableName: TABLE_NAME,
      });

      const response = await docClient.send(command);
      return response.Items as User[];
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      throw new Error(`Failed to get all users: ${(error as Error).message}`);
    }
  },

  async getMentionableUsers() {
    try {
      const command = new ScanCommand({
        TableName: TABLE_NAME,
      });

      const response = await docClient.send(command);
      const users = response.Items as User[];
      
      // Add AI user to the list of mentionable users
      return [AI_USER, ...users];
    } catch (error) {
      console.error('Error in getMentionableUsers:', error);
      throw new Error(`Failed to get mentionable users: ${(error as Error).message}`);
    }
  }
}; 