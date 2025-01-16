import { useState, useEffect } from 'react';
import { socket, connectSocket } from '../config/socket';
import { FaTrash } from 'react-icons/fa';

interface Channel {
  channelId: string;
  name: string;
  createdBy: string;
  createdAt: number;
}

interface ChannelsListProps {
  user: {
    uid: string;
    email: string | null;
  };
  onChannelSelect: (channel: { id: string; name: string; } | null) => void;
  selectedChannelId: string;
}

export const ChannelsList = ({ user, onChannelSelect, selectedChannelId }: ChannelsListProps) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');

  useEffect(() => {
    if (user?.uid) {
      // Ensure socket is connected
      const initializeSocket = async () => {
        await connectSocket(user.uid);
        socket.emit('get_channels');
      };

      initializeSocket();

      // Handle socket events
      const handleChannels = (channelList: Channel[]) => {
        setChannels(channelList);
      };

      const handleChannelCreated = (newChannel: Channel) => {
        setChannels(prev => [...prev, newChannel]);
      };

      const handleChannelDeleted = (deletedChannelId: string) => {
        setChannels(prev => prev.filter(channel => channel.channelId !== deletedChannelId));
        if (selectedChannelId === deletedChannelId) {
          onChannelSelect(null); // Reset selected channel if it was deleted
        }
      };

      // Listen for events
      socket.on('channels', handleChannels);
      socket.on('channel_created', handleChannelCreated);
      socket.on('channel_deleted', handleChannelDeleted);
      
      // Handle reconnection
      socket.on('connect', () => {
        socket.emit('get_channels');
      });

      return () => {
        socket.off('channels', handleChannels);
        socket.off('channel_created', handleChannelCreated);
        socket.off('connect');
        socket.off('channel_deleted', handleChannelDeleted);
      };
    }
  }, [user?.uid, selectedChannelId, onChannelSelect]);

  const createChannel = async () => {
    if (!newChannelName.trim()) return;

    try {
      socket.emit('create_channel', {
        name: newChannelName.trim(),
        createdBy: user.uid,
      });

      setNewChannelName('');
      setIsCreating(false);
    } catch (error) {
      console.error('Error creating channel:', error);
    }
  };

  const handleDeleteChannel = (channelId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (window.confirm('Are you sure you want to delete this channel? This action cannot be undone.')) {
      socket.emit('delete_channel', channelId);
      if (selectedChannelId === channelId) {
        onChannelSelect(null);
      }
    }
  };

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-2 px-2">
        <h2 className="text-lg font-semibold">Channels</h2>
        <button
          onClick={() => setIsCreating(true)}
          className="text-sm bg-gray-700 px-2 py-1 rounded hover:bg-gray-600"
        >
          +
        </button>
      </div>

      {isCreating && (
        <div className="px-4 py-2">
          <input
            type="text"
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            placeholder="Channel name"
            className="w-full px-2 py-1 text-sm text-black rounded"
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={createChannel}
              className="px-2 py-1 text-sm bg-green-500 rounded hover:bg-green-600"
            >
              Create
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewChannelName('');
              }}
              className="px-2 py-1 text-sm bg-gray-500 rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <ul className="space-y-1">
        {channels.length === 0 && !isCreating && (
          <li className="px-2 py-1 text-gray-400 text-sm">
            No channels available
          </li>
        )}
        {channels.map((channel) => (
          <li
            key={channel.channelId}
            className={`
              relative px-2 py-1 rounded cursor-pointer
              ${selectedChannelId === channel.channelId ? 'bg-gray-700' : ''}
              group hover:bg-gray-700
            `}
            onClick={() => onChannelSelect({ id: channel.channelId, name: channel.name })}
          >
            <div className="flex items-center justify-between w-full">
              <span className="flex-grow"># {channel.name}</span>
              <button
                onClick={(e) => handleDeleteChannel(channel.channelId, e)}
                className="hidden group-hover:block text-red-500 hover:text-red-400"
                title="Delete channel"
              >
                <FaTrash size={12} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}; 