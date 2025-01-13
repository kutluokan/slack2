import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ChannelsList } from '../components/ChannelsList';
import { DirectMessagesList } from '../components/DirectMessagesList';
import { MessageList } from '../components/MessageList';
import { useMessages } from '../hooks/useMessages';
import { AIAvatarList } from '../components/AIAvatarList';

export default function Home() {
  const { user, loading, error, signInWithGoogle, logout } = useAuth();
  const [selectedChannel, setSelectedChannel] = useState(() => {
    // Try to get the channel from localStorage on initial load
    if (typeof window !== 'undefined') {
      const savedChannel = localStorage.getItem('selectedChannel');
      if (savedChannel) {
        return JSON.parse(savedChannel);
      }
    }
    return { id: 'general', name: 'general' };
  });
  const { messages, sendMessage, addReaction } = useMessages(selectedChannel.id);
  const [selectedAIUser, setSelectedAIUser] = useState<string | null>(null);
  const [isAIAvatarView, setIsAIAvatarView] = useState(false);

  // Handle D-ID script
  useEffect(() => {
    if (selectedAIUser && isAIAvatarView) {
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
  }, [selectedAIUser, isAIAvatarView]);

  const handleChannelChange = (channel: { id: string; name: string }) => {
    if (isAIAvatarView) {
      // If we're switching from AI avatar view, store channel and refresh
      localStorage.setItem('selectedChannel', JSON.stringify(channel));
      window.location.reload();
    } else {
      // Normal channel switch, just update state
      setSelectedChannel(channel);
      setIsAIAvatarView(false);
    }
  };

  const handleAIAvatarSelect = (userId: string) => {
    setSelectedAIUser(userId);
    setIsAIAvatarView(true);
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
                onUserSelect={handleAIAvatarSelect}
              />
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="h-16 border-b flex items-center px-6">
              <h2 className="text-lg font-semibold">
                {isAIAvatarView ? "Kay's AI Avatar" : `${selectedChannel.name.startsWith('dm_') ? '@' : '#'}${selectedChannel.name}`}
              </h2>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
              {isAIAvatarView ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <div id="did-host" className="w-full h-full"></div>
                  <div className="text-center mt-4 text-gray-600">
                    Welcome to Kay&apos;s AI Avatar! This is a dedicated space for interacting with the D-ID powered AI avatar.
                  </div>
                </div>
              ) : (
                <MessageList
                  messages={messages}
                  onReactionAdd={addReaction}
                  onThreadReply={(messageId) => {
                    console.log('Thread reply to:', messageId);
                  }}
                />
              )}
            </div>

            {/* Message Input */}
            {!isAIAvatarView && (
              <div className="p-4 border-t bg-white">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        sendMessage(e.currentTarget.value, user.uid, user.displayName || user.email || 'Anonymous');
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  <button
                    onClick={(e) => {
                      const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                      if (input.value.trim()) {
                        sendMessage(input.value, user.uid, user.displayName || user.email || 'Anonymous');
                        input.value = '';
                      }
                    }}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}