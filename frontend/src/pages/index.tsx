import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ChannelsList } from '../components/ChannelsList';
import { DirectMessagesList } from '../components/DirectMessagesList';
import { MessageList } from '../components/MessageList';
import { useMessages } from '../hooks/useMessages';
import { AIAvatarList } from '../components/AIAvatarList';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();
  const { user, loading, error, signInWithGoogle, logout } = useAuth();
  const [selectedChannel, setSelectedChannel] = useState({ id: 'general', name: 'general' });
  const { messages, sendMessage, addReaction } = useMessages(selectedChannel.id);
  const [selectedAIUser, setSelectedAIUser] = useState<string | null>(null);

  // Handle D-ID script
  useEffect(() => {
    if (selectedAIUser) {
      // Add D-ID script
      const script = document.createElement('script');
      script.type = 'module';
      script.src = 'https://agent.d-id.com/v1/index.js';
      script.dataset.name = 'did-agent';
      script.dataset.mode = 'fabio';
      script.dataset.clientKey = 'Z29vZ2xlLW9hdXRoMnwxMDU1MTkxNDQ1NDczNjAwODcwMDY6aXN2RkZ0UmJzOXVGOHZQUlUzQk9D';
      script.dataset.agentId = 'agt_RTXhEo8N';
      script.dataset.monitor = 'true';
      document.body.appendChild(script);

      return () => {
        // Remove D-ID script when component unmounts or user changes
        document.body.removeChild(script);
      };
    }
  }, [selectedAIUser]);

  const handleChannelChange = (channel: { id: string; name: string }) => {
    if (selectedAIUser) {
      // If AI avatar is active, refresh the page with new channel
      router.reload();
    }
    setSelectedChannel(channel);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold mb-6 text-center">Welcome to Slack2</h1>
          {error && <div className="text-red-500 mb-4">{error}</div>}
          <button
            onClick={signInWithGoogle}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Head>
        <title>Slack2</title>
        <meta name="description" content="Slack2 - AI-powered chat application" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container mx-auto px-4">
        <div className="flex h-screen">
          {/* Sidebar */}
          <div className="w-64 bg-gray-800 text-white">
            <div className="p-4">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold">Slack2</h1>
                <button
                  onClick={logout}
                  className="text-sm bg-red-500 px-2 py-1 rounded hover:bg-red-600 transition-colors"
                >
                  Logout
                </button>
              </div>
              <div className="mt-2 text-sm text-gray-300">
                {user.email ?? ''}
              </div>
              <ChannelsList 
                user={{
                  uid: user.uid,
                  email: user.email
                }} 
                onChannelSelect={handleChannelChange}
                selectedChannelId={selectedChannel.id}
              />
              <DirectMessagesList
                currentUser={{
                  uid: user.uid,
                  email: user.email
                }}
                onChannelSelect={handleChannelChange}
                selectedChannelId={selectedChannel.id}
              />
              <AIAvatarList
                currentUser={{
                  uid: user.uid,
                  email: user.email
                }}
                onUserSelect={setSelectedAIUser}
                selectedUserId={selectedAIUser}
              />
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="h-16 border-b flex items-center px-6">
              <h2 className="text-lg font-semibold">
                {selectedChannel.name.startsWith('dm_') ? '@' : '#'}
                {selectedChannel.name}
              </h2>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6">
              <MessageList
                messages={messages}
                onReactionAdd={addReaction}
                onThreadReply={(messageId) => {
                  // Handle thread reply - you can implement this later
                  console.log('Thread reply to:', messageId);
                }}
              />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t">
              <input
                type="text"
                placeholder="Type a message..."
                className="w-full px-4 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    sendMessage(e.currentTarget.value, user.uid, user.email || 'Anonymous');
                    e.currentTarget.value = '';
                  }
                }}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}