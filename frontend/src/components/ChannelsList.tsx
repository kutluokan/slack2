import { useState, useEffect } from 'react';
import { socket } from '../config/socket';

interface Channel {
  channelId: string;
  name: string;
  isPrivate: boolean;
}

export const ChannelsList = ({ user }: { user: any }) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');

  useEffect(() => {
    socket.emit('get_channels');

    socket.on('channels', (channelList) => {
      setChannels(channelList);
    });

    socket.on('channel_created', (newChannel) => {
      setChannels(prev => [...prev, newChannel]);
    });

    return () => {
      socket.off('channels');
      socket.off('channel_created');
    };
  }, []);

  const createChannel = async () => {
    if (!newChannelName.trim()) return;

    socket.emit('create_channel', {
      name: newChannelName,
      createdBy: user.uid,
      isPrivate: false,
      members: [user.uid]
    });

    setNewChannelName('');
    setIsCreating(false);
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
            className="px-4 py-1 text-gray-300 hover:bg-gray-700 cursor-pointer"
          >
            # {channel.name}
          </li>
        ))}
      </ul>
    </div>
  );
}; 