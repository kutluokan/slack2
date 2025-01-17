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
const LOCAL_STORAGE_DIR = path.join(process.cwd(), 'uploads');
console.log('S3 service upload directory:', LOCAL_STORAGE_DIR);

// Create directory if it doesn't exist
if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
  console.log('Creating S3 service upload directory at:', LOCAL_STORAGE_DIR);
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
      console.log(`Processing file: ${fileUpload.fileName}`);
      
      // Validate file size (e.g., 100MB limit)
      const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
      if (fileUpload.fileSize > MAX_FILE_SIZE) {
        throw new Error('File size exceeds maximum limit of 100MB');
      }

      // Sanitize file name to prevent directory traversal
      const sanitizedFileName = path.basename(fileUpload.fileName);
      const timestamp = Date.now();
      const key = `uploads/${timestamp}-${sanitizedFileName}`;

      // Save file locally first
      const localFilename = `${timestamp}-${sanitizedFileName}`;
      const localPath = path.join(LOCAL_STORAGE_DIR, localFilename);
      
      if (fileUpload.fileContent) {
        try {
          await fs.promises.writeFile(localPath, fileUpload.fileContent);
          console.log(`File saved locally at: ${localPath}`);
        } catch (writeError) {
          console.error('Error writing file locally:', writeError);
          throw new Error(`Failed to save file locally: ${(writeError as Error).message}`);
        }
      } else {
        throw new Error('No file content provided');
      }

      // Upload to S3
      const uploadCommand = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        Body: fileUpload.fileContent,
        ContentType: fileUpload.fileType,
        ContentLength: fileUpload.fileSize
      });

      try {
        await s3Client.send(uploadCommand);
        console.log(`File uploaded to S3 with key: ${key}`);
      } catch (s3Error) {
        // If S3 upload fails, we still keep the local file
        console.error('Error uploading to S3:', s3Error);
        throw new Error(`Failed to upload to S3: ${(s3Error as Error).message}`);
      }

      // Generate a download URL
      const getCommand = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key
      });
      const downloadUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

      return {
        uploadUrl: '', // No longer needed as we upload directly
        fileUrl: downloadUrl,
        key,
        localPath
      };
    } catch (error) {
      console.error('Error processing file:', error);
      throw new Error(`Failed to process file: ${(error as Error).message}`);
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