import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_BUCKET_NAME'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

// Ensure local storage directory exists
const LOCAL_STORAGE_DIR = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
  fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
}

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  },
  maxAttempts: 3
});

export interface FileUpload {
  fileName: string;
  fileType: string;
  fileSize: number;
  fileContent?: Buffer;
}

export const s3Service = {
  async getUploadPresignedUrl(fileUpload: FileUpload) {
    try {
      console.log(`Generating upload URL for file: ${fileUpload.fileName}`);
      
      // Validate file size (e.g., 100MB limit)
      const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
      if (fileUpload.fileSize > MAX_FILE_SIZE) {
        throw new Error('File size exceeds maximum limit of 100MB');
      }

      // Sanitize file name to prevent directory traversal
      const sanitizedFileName = path.basename(fileUpload.fileName);
      const key = `uploads/${Date.now()}-${sanitizedFileName}`;

      const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        ContentType: fileUpload.fileType,
        ContentLength: fileUpload.fileSize
      });

      // Save file locally if it's a PDF or TXT
      if (fileUpload.fileContent && (fileUpload.fileType === 'application/pdf' || fileUpload.fileType === 'text/plain')) {
        const localPath = path.join(LOCAL_STORAGE_DIR, sanitizedFileName);
        fs.writeFileSync(localPath, fileUpload.fileContent);
        console.log(`File saved locally at: ${localPath}`);
      }

      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      console.log(`Upload URL generated successfully for key: ${key}`);

      // Generate a pre-signed URL for immediate download after upload
      const getCommand = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key
      });
      const downloadUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

      return {
        uploadUrl,
        fileUrl: downloadUrl,
        key
      };
    } catch (error) {
      console.error('Error generating upload URL:', error);
      throw new Error(`Failed to generate upload URL: ${(error as Error).message}`);
    }
  },

  async getDownloadPresignedUrl(key: string) {
    try {
      console.log(`Generating download URL for key: ${key}`);

      if (!key) {
        throw new Error('S3 key is required');
      }

      const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key
      });

      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      console.log(`Download URL generated successfully for key: ${key}`);

      return presignedUrl;
    } catch (error) {
      console.error('Error generating download URL:', error);
      throw new Error(`Failed to generate download URL: ${(error as Error).message}`);
    }
  },

  async validateS3Access() {
    try {
      const testKey = 'test/access-check.txt';
      const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: testKey,
        Body: 'Access check',
        ContentType: 'text/plain'
      });

      await s3Client.send(command);
      console.log('S3 access validation successful');
      return true;
    } catch (error) {
      console.error('S3 access validation failed:', error);
      return false;
    }
  }
}; 