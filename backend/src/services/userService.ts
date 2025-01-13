import { PutCommand, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../config/dynamodb";

const TABLE_NAME = "K_Users";

export interface User {
  userId: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: number;
  lastLogin: number;
}

export const userService = {
  async createOrUpdateUser(userData: Omit<User, 'createdAt' | 'lastLogin'>) {
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
        existingUser = response.Item;
      } catch (error) {
        console.error('Error fetching existing user:', error);
        // Continue with creation if user doesn't exist
      }
      
      const user: User = {
        ...userData,
        displayName: userData.displayName || userData.email.split('@')[0] || 'Anonymous',
        createdAt: existingUser ? existingUser.createdAt : now,
        lastLogin: now,
      };

      const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: user,
      });

      await docClient.send(command);
      console.log('User successfully created/updated:', user.userId);
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
}; 