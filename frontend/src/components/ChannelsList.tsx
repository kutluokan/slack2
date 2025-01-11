import { useState, useEffect } from 'react';
import { socket, connectSocket } from '../config/socket';

interface Channel {
  channelId: string;
  name: string;
  isPrivate: boolean;
}

interface ChannelsListProps {
  user: {
    uid: string;
    email: string | null;
  };
  onChannelSelect: (channel: { id: string; name: string }) => void;
  selectedChannelId: string;
}

export const ChannelsList = ({ user, onChannelSelect, selectedChannelId }: ChannelsListProps) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');

  useEffect(() => {
    if (user?.uid) {
      connectSocket(user.uid);
      socket.emit('get_channels');

      socket.on('channels', (channelList: Channel[]) => {
        setChannels(channelList);
      });

      socket.on('channel_created', (newChannel: Channel) => {
        setChannels(prev => [...prev, newChannel]);
      });

      return () => {
        socket.off('channels');
        socket.off('channel_created');
      };
    }
  }, [user?.uid]);

  const createChannel = async () => {
    if (!newChannelName.trim()) return;

    try {
      socket.emit('create_channel', {
        name: newChannelName.trim(),
        createdBy: user.uid,
        isPrivate: false,
        members: [user.uid]
      });

      setNewChannelName('');
      setIsCreating(false);
    } catch (error) {
      console.error('Error creating channel:', error);
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between px-4 mb-2">
        <h2 className="text-lg font-semibold text-gray-300">Channels</h2>
        <button
          onClick={() => setIsCreating(true)}
          className="text-gray-400 hover:text-white"
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
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={createChannel}
              className="px-2 py-1 text-sm bg-green-500 rounded hover:bg-green-600"
            >
              Create
            </button>
            <button
              onClick={() => setIsCreating(false)}
              className="px-2 py-1 text-sm bg-gray-500 rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <ul className="space-y-1">
        {channels.map((channel) => (
          <li
            key={channel.channelId}
            onClick={() => onChannelSelect({ id: channel.channelId, name: channel.name })}
            className={`px-4 py-1 text-gray-300 hover:bg-gray-700 cursor-pointer ${
              selectedChannelId === channel.channelId ? 'bg-gray-700' : ''
            }`}
          >
            # {channel.name}
          </li>
        ))}
      </ul>
    </div>
  );
}; 