import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ChannelsList } from '../components/ChannelsList';
import { DirectMessagesList } from '../components/DirectMessagesList';
import { MessageList } from '../components/MessageList';
import { useMessages } from '../hooks/useMessages';
import { AIAvatarList } from '../components/AIAvatarList';
import { MessageInput } from '../components/MessageInput';
import { PresenceIndicator } from '../components/PresenceIndicator';
import { SearchBar } from '../components/SearchBar';

export default function Home() {
  const { user, loading, error, signInWithGoogle, logout } = useAuth();
  const [selectedChannel, setSelectedChannel] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedChannel = localStorage.getItem('selectedChannel');
      try {
        if (savedChannel) {
          const parsed = JSON.parse(savedChannel);
          if (parsed && parsed.id && parsed.name) {
            return parsed;
          }
        }
      } catch (error) {
        console.error('Error parsing saved channel:', error);
      }
    }
    return null;
  });
  const { messages, sendMessage, addReaction, deleteMessage } = useMessages(selectedChannel?.id || '');
  const [selectedAIUser, setSelectedAIUser] = useState<string | null>(null);
  const [isAIAvatarView, setIsAIAvatarView] = useState(false);

  useEffect(() => {
    if (!selectedChannel) {
      const defaultChannel = { id: 'general', name: 'general' };
      setSelectedChannel(defaultChannel);
      localStorage.setItem('selectedChannel', JSON.stringify(defaultChannel));
    }
  }, [selectedChannel]);

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

  const handleChannelChange = (channel: { id: string; name: string } | null) => {
    if (!channel) {
      const defaultChannel = { id: 'general', name: 'general' };
      setSelectedChannel(defaultChannel);
      localStorage.setItem('selectedChannel', JSON.stringify(defaultChannel));
      setIsAIAvatarView(false);
      return;
    }

    if (isAIAvatarView) {
      setSelectedChannel(channel);
      localStorage.setItem('selectedChannel', JSON.stringify(channel));
      window.location.reload();
    } else {
      setSelectedChannel(channel);
      localStorage.setItem('selectedChannel', JSON.stringify(channel));
      setIsAIAvatarView(false);
    }
  };

  const handleAIAvatarSelect = (userId: string) => {
    setSelectedAIUser(userId);
    setIsAIAvatarView(true);
  };

  const handleSearchResultSelect = (result: {
    channelId: string;
    messageId: string;
    content: string;
  }) => {
    // Switch to the channel containing the message
    handleChannelChange({
      id: result.channelId,
      name: result.channelId.startsWith('dm_') ? result.channelId : 'general'
    });

    // Wait for messages to load, then scroll to the message
    setTimeout(() => {
      const messageElement = document.getElementById(result.messageId);
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth' });
        messageElement.classList.add('bg-yellow-100', 'dark:bg-yellow-900');
        setTimeout(() => {
          messageElement.classList.remove('bg-yellow-100', 'dark:bg-yellow-900');
        }, 2000);
      }
    }, 500);
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
          <h1 className="text-2xl font-bold mb-6 text-center">Welcome to Chat Genius AI</h1>
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
        <title>Chat Genius AI</title>
        <meta name="description" content="Chat Genius AI - AI-powered chat application" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container mx-auto px-4">
        <div className="flex h-screen">
          {/* Sidebar */}
          <div className="w-64 bg-gray-800 text-white">
            <div className="p-4">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold">Chat Genius AI</h1>
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
              {user && <PresenceIndicator userId={user.uid} />}
              
              {/* Add SearchBar component */}
              <div className="mt-4">
                <SearchBar onResultSelect={handleSearchResultSelect} />
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
                  onDelete={deleteMessage}
                />
              )}
            </div>

            {/* Message Input */}
            {!isAIAvatarView && (
              <div className="p-4 border-t bg-white">
                <MessageInput
                  onSendMessage={sendMessage}
                  currentUser={user}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}