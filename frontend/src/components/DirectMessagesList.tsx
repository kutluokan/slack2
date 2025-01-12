import { useState, useEffect } from 'react';
import { socket } from '../config/socket';

interface User {
  userId: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}

interface Channel {
  channelId: string;
  name: string;
  createdBy: string;
  createdAt: number;
  isDM: boolean;
  participants: string[];
}

interface DirectMessagesListProps {
  currentUser: {
    uid: string;
    email: string | null;
  };
  onChannelSelect: (channel: { id: string; name: string }) => void;
  selectedChannelId: string;
}

export const DirectMessagesList = ({ currentUser, onChannelSelect, selectedChannelId }: DirectMessagesListProps) => {
  const [dmChannels, setDmChannels] = useState<Channel[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isSelectingUser, setIsSelectingUser] = useState(false);

  useEffect(() => {
    if (currentUser?.uid) {
      socket.emit('get_dm_channels', { userId: currentUser.uid });
      socket.emit('get_users');

      const handleDMChannels = (channels: Channel[]) => {
        setDmChannels(channels);
      };

      const handleUsers = (userList: User[]) => {
        // Filter out current user
        setUsers(userList.filter(user => user.userId !== currentUser.uid));
      };

      const handleDMChannelCreated = (newChannel: Channel) => {
        setDmChannels(prev => [...prev, newChannel]);
      };

      socket.on('dm_channels', handleDMChannels);
      socket.on('users', handleUsers);
      socket.on('dm_channel_created', handleDMChannelCreated);

      return () => {
        socket.off('dm_channels', handleDMChannels);
        socket.off('users', handleUsers);
        socket.off('dm_channel_created', handleDMChannelCreated);
      };
    }
  }, [currentUser?.uid]);

  const createDMChannel = async (otherUserId: string) => {
    socket.emit('create_dm_channel', {
      user1Id: currentUser.uid,
      user2Id: otherUserId,
    });
    setIsSelectingUser(false);
  };

  const getChannelDisplayName = (channel: Channel) => {
    const otherUserId = channel.participants.find(id => id !== currentUser.uid);
    const otherUser = users.find(user => user.userId === otherUserId);
    return otherUser?.displayName || otherUser?.email || 'Unknown User';
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between px-4 mb-2">
        <h2 className="text-lg font-semibold text-gray-300">Direct Messages</h2>
        <button
          onClick={() => setIsSelectingUser(true)}
          className="text-gray-400 hover:text-white"
        >
          +
        </button>
      </div>

      {isSelectingUser && (
        <div className="px-4 py-2">
          <h3 className="text-sm text-gray-400 mb-2">Select a user</h3>
          <ul className="space-y-1">
            {users.map((user) => (
              <li
                key={user.userId}
                onClick={() => createDMChannel(user.userId)}
                className="px-2 py-1 text-gray-300 hover:bg-gray-700 cursor-pointer rounded"
              >
                {user.displayName || user.email}
              </li>
            ))}
          </ul>
          <button
            onClick={() => setIsSelectingUser(false)}
            className="mt-2 px-2 py-1 text-sm bg-gray-500 rounded hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>
      )}

      <ul className="space-y-1">
        {dmChannels.map((channel) => (
          <li
            key={channel.channelId}
            onClick={() => onChannelSelect({ id: channel.channelId, name: getChannelDisplayName(channel) })}
            className={`px-4 py-1 text-gray-300 hover:bg-gray-700 cursor-pointer ${
              selectedChannelId === channel.channelId ? 'bg-gray-700' : ''
            }`}
          >
            @ {getChannelDisplayName(channel)}
          </li>
        ))}
      </ul>
    </div>
  );
}; 