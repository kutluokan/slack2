import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import dotenv from 'dotenv';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

// Log AWS configuration (without sensitive data)
console.log('AWS Configuration:', {
  region: process.env.AWS_REGION,
  hasAccessKeyId: !!process.env.AWS_ACCESS_KEY_ID,
  hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
});

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  },
  maxAttempts: 5,  // Increased retry attempts
  systemClockOffset: 0,
  retryMode: 'adaptive',
  logger: console,  // Enable AWS SDK logging
});

// Middleware to handle common DynamoDB errors
const handleDynamoDBError = (err: any) => {
  if (err.name === 'InvalidSignatureException') {
    console.error('AWS Signature Error:', {
      message: err.message,
      time: new Date().toISOString(),
      systemTime: Date.now(),
    });
  }
  throw err;
};

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
}); 