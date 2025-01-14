# Chat Genius AI Product Requirements Document
I want to create an AI messaging app called Chat Genius AI. It will be a Slack clone with AI features. It will have all the features specified in the product requirements files.

The features (in order of implementation) are:
1. Realtime messaging
2. Channels
3. AI replies
4. Voice Synthesizing
5. Video Synthesizing
6. The rest of the features...

I have access to the following features on AWS:
S3
EC2
EKS
ECS
Bedrock
Api Gateway
ECR
Firebase
These should be used in the stack where needed. Otherwise, use free technologies as much as you can.

I want a single page application so don't use URL addresses to navigate between pages.

# Features
Authentication
• Users need secure sign-up/sign-in.
• Basic account management (profile data, password changes, etc.).
* Log in using Google account and Github account
Real-time Messaging
• One-to-one direct messages (DM).
• Live updates (new messages appear in real time).
Channels
• Users can create and join multiple channels.
• Users can direct message other users privately.
* Channel messages are grouped nicely in a channel. If a user sends a message, it will be grouped with the previous message in the channel.
* There should be an option to delete messages
File Sharing & Search
• Users can upload and share files in channels or DMs.
• Uploaded files should be stored securely.
• A basic search feature to locate files/messages.
User Presence & Status
• Show whether a user is online (active) or offline/away.
• Allow user-customizable status messages.
* Users can change their status to online, offline, or away.
* When a user logs out, their status will be set to offline.
Thread Support
• Users can reply to a specific message, creating a sub-thread.
• Keep thread discussions neatly grouped.
Replies
* Users can reply to a specific person by mentioning their nickname, without creating a sub-thread.
Emoji Reactions
• Allow quick emoji reactions to messages.
AI Avatar / AI Replies
• Ability for the system to generate messages on behalf of a user (context-aware, reflecting the user’s “personality”).
Voice Synthesis
• Generate spoken versions of messages.
Video Synthesis / Visual Avatar
• Use an API (e.g., D-ID, HeyGen) to generate a video avatar.

# Tech Stack

Frontend

    Language & Framework: React (TypeScript)

    State Management: Redux Toolkit

    Real-time Communication: Socket.io client

    Styling: Tailwind CSS

    UI Components: Material UI

    Authentication and Data Handling: ?

Backend

    Language & Framework: Node.js with Express.js

    Real-time Communication: Socket.io

    Database: AWS DynamoDB

    Caching: Redis (Optional)

    File Storage: AWS S3

AI & ML

    LLM / Prompt Handler: OpenAI API

    Voice Synthesis: AWS Polly

    Video Synthesis (Optional): D-ID or HeyGen API

Deployment & DevOps

    Server Hosting: AWS EC2

    Frontend Hosting: AWS S3 (potentially managed by AWS Amplify)

    CI/CD: GitHub Actions

    Containerization: Docker
