import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ChannelsList } from '../components/ChannelsList';
import { DirectMessagesList } from '../components/DirectMessagesList';
import { MessageList } from '../components/MessageList';
import { useMessages } from '../hooks/useMessages';
import { AIAvatarList } from '../components/AIAvatarList';
import { MessageInput } from '../components/MessageInput';
import { SearchBar } from '../components/SearchBar';
import { Thread } from '../components/Thread';
import type { Message as MessageType } from '../hooks/useMessages';
import { socket } from '../config/socket';
import { UserProfile } from '../components/UserProfile';

interface Channel {
  channelId: string;
  name: string;
  createdBy: string;
  createdAt: number;
  isDM?: boolean;
  participants?: string[];
}

export default function Home() {
  const { user, loading: authLoading, error, signInWithGoogle, logout } = useAuth();
  const [selectedChannel, setSelectedChannel] = useState<{ id: string; name: string } | null>(null);
  const [channelLoading, setChannelLoading] = useState(true);
  const { messages, sendMessage, addReaction, deleteMessage } = useMessages(selectedChannel?.id || '');
  const [selectedAIUser, setSelectedAIUser] = useState<string | null>(null);
  const [isAIAvatarView, setIsAIAvatarView] = useState(false);
  const [activeThread, setActiveThread] = useState<MessageType | null>(null);

  // Load saved channel on initial render and after login
  useEffect(() => {
    if (user) {
      setChannelLoading(true);
      const savedChannel = localStorage.getItem('selectedChannel');
      try {
        if (savedChannel) {
          const parsed = JSON.parse(savedChannel);
          if (parsed && parsed.id && parsed.name) {
            // Verify if the channel still exists
            socket.emit('get_channels');
            socket.once('channels', (channels: Channel[]) => {
              const channelExists = channels.some(ch => ch.channelId === parsed.id);
              if (channelExists) {
                setSelectedChannel(parsed);
              } else {
                // Channel no longer exists, clear selection
                localStorage.removeItem('selectedChannel');
                setSelectedChannel(null);
              }
              setChannelLoading(false);
            });
          } else {
            localStorage.removeItem('selectedChannel');
            setSelectedChannel(null);
            setChannelLoading(false);
          }
        } else {
          // No saved channel, try to select first available
          socket.emit('get_channels');
          socket.once('channels', (channels: Channel[]) => {
            if (channels && channels.length > 0) {
              const newChannel = { id: channels[0].channelId, name: channels[0].name };
              setSelectedChannel(newChannel);
              localStorage.setItem('selectedChannel', JSON.stringify(newChannel));
            } else {
              setSelectedChannel(null);
            }
            setChannelLoading(false);
          });
        }
      } catch (error) {
        console.error('Error loading saved channel:', error);
        localStorage.removeItem('selectedChannel');
        setSelectedChannel(null);
        setChannelLoading(false);
      }
    } else {
      setSelectedChannel(null);
      localStorage.removeItem('selectedChannel');
      setChannelLoading(false);
    }
  }, [user]);

  // Handle channel deletion
  useEffect(() => {
    const handleChannelDeleted = (deletedChannelId: string) => {
      if (selectedChannel?.id === deletedChannelId) {
        socket.emit('get_channels');
        socket.once('channels', (channels: Channel[]) => {
          if (channels && channels.length > 0) {
            const newChannel = { id: channels[0].channelId, name: channels[0].name };
            setSelectedChannel(newChannel);
            localStorage.setItem('selectedChannel', JSON.stringify(newChannel));
          } else {
            setSelectedChannel(null);
            localStorage.removeItem('selectedChannel');
          }
        });
      }
    };

    socket.on('channel_deleted', handleChannelDeleted);

    return () => {
      socket.off('channel_deleted', handleChannelDeleted);
    };
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
      // Get channels and select either last visited or first available
      socket.emit('get_channels');
      socket.once('channels', (channels: Channel[]) => {
        if (channels && channels.length > 0) {
          const newChannel = { id: channels[0].channelId, name: channels[0].name };
          setSelectedChannel(newChannel);
          localStorage.setItem('selectedChannel', JSON.stringify(newChannel));
          setIsAIAvatarView(false);
        }
      });
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
    channelName?: string;
  }) => {
    // Switch to the channel containing the message
    handleChannelChange({
      id: result.channelId,
      name: result.channelName || result.channelId
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

  const handleThreadReply = (messageId: string) => {
    const parentMessage = messages.find(msg => msg.messageId === messageId);
    if (parentMessage) {
      setActiveThread(parentMessage);
    }
  };

  const handleThreadMessageSend = (
    content: string,
    userId: string,
    username: string,
    fileAttachment?: {
      fileName: string;
      fileType: string;
      fileSize: number;
      fileUrl: string;
      s3Key: string;
    }
  ) => {
    if (activeThread) {
      sendMessage(content, userId, username, fileAttachment, activeThread.messageId);
    }
  };

  // Filter thread messages
  const threadMessages = activeThread
    ? messages.filter(msg => msg.parentMessageId === activeThread.messageId)
    : [];

  if (authLoading || (user && channelLoading)) {
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
          {/* Sidebar - Always visible */}
          <div className="w-64 bg-gray-800 text-white p-4 flex flex-col h-full">
            <UserProfile user={user} />
            <div className="mb-4">
              <SearchBar onResultSelect={handleSearchResultSelect} />
            </div>
            <div className="flex-1 overflow-y-auto">
              <ChannelsList
                user={user}
                onChannelSelect={handleChannelChange}
                selectedChannelId={selectedChannel?.id || ''}
              />
              <DirectMessagesList
                currentUser={user}
                onChannelSelect={handleChannelChange}
                selectedChannelId={selectedChannel?.id || ''}
              />
              <AIAvatarList onUserSelect={handleAIAvatarSelect} />
            </div>
            <button
              onClick={logout}
              className="mt-4 w-full text-sm bg-gray-700 px-3 py-2 rounded hover:bg-gray-600 text-center"
            >
              Logout
            </button>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col">
            {!selectedChannel ? (
              <div className="flex-1 flex items-center justify-center bg-white">
                <div className="text-center max-w-2xl mx-auto px-4">
                  <h1 className="text-4xl font-bold mb-6 text-gray-800">Welcome to Chat Genius AI</h1>
                  <p className="text-xl text-gray-600 mb-4">Your intelligent chat companion</p>
                  <p className="text-gray-500">Select a channel from the sidebar to start chatting or create a new one to begin your conversation.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 flex">
                  <div className={`flex-1 flex flex-col ${activeThread ? 'border-r' : ''}`}>
                    <div className="bg-white border-b px-4 py-2">
                      <h2 className="text-xl font-semibold">#{selectedChannel.name}</h2>
                    </div>
                    <MessageList
                      messages={messages.filter(msg => !msg.parentMessageId)}
                      onReactionAdd={addReaction}
                      onThreadReply={handleThreadReply}
                      onDelete={deleteMessage}
                    />
                    <MessageInput
                      onSendMessage={(content, userId, username, fileAttachment) =>
                        sendMessage(content, userId, username, fileAttachment)
                      }
                      currentUser={user}
                    />
                  </div>
                  {activeThread && (
                    <Thread
                      parentMessage={activeThread}
                      threadMessages={threadMessages}
                      onClose={() => setActiveThread(null)}
                      onSendMessage={(content, userId, username, fileAttachment) =>
                        handleThreadMessageSend(content, userId, username, fileAttachment)
                      }
                      onReactionAdd={addReaction}
                      onDelete={deleteMessage}
                      currentUser={user}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}