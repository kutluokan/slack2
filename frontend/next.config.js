/** @type {import('next').NextConfig} */
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const nextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_DID_CLIENT_KEY: process.env.NEXT_PUBLIC_DID_CLIENT_KEY,
    NEXT_PUBLIC_DID_AGENT_ID: process.env.NEXT_PUBLIC_DID_AGENT_ID
  },
  images: {
    domains: ['lh3.googleusercontent.com', 'upload.wikimedia.org'],
  },
};

module.exports = nextConfig; 