import { useState, useEffect } from 'react';
import { socket } from '../config/socket';
import { FaTrash } from 'react-icons/fa';

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
  const [hoveredChannel, setHoveredChannel] = useState<string | null>(null);

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

      const handleChannelDeleted = (deletedChannelId: string) => {
        setDmChannels(prev => prev.filter(channel => channel.channelId !== deletedChannelId));
        if (selectedChannelId === deletedChannelId) {
          onChannelSelect(null); // Reset selected channel if it was deleted
        }
      };

      socket.on('dm_channels', handleDMChannels);
      socket.on('users', handleUsers);
      socket.on('dm_channel_created', handleDMChannelCreated);
      socket.on('channel_deleted', handleChannelDeleted);

      return () => {
        socket.off('dm_channels', handleDMChannels);
        socket.off('users', handleUsers);
        socket.off('dm_channel_created', handleDMChannelCreated);
        socket.off('channel_deleted', handleChannelDeleted);
      };
    }
  }, [currentUser?.uid, selectedChannelId, onChannelSelect]);

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

  const handleDeleteDM = (channelId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (window.confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
      socket.emit('delete_channel', channelId);
    }
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
            className={`relative px-2 py-1 rounded cursor-pointer group ${
              selectedChannelId === channel.channelId ? 'bg-gray-700' : 'hover:bg-gray-700'
            }`}
            onClick={() => onChannelSelect({ id: channel.channelId, name: getChannelDisplayName(channel) })}
          >
            <div className="flex justify-between items-center">
              <span>{getChannelDisplayName(channel)}</span>
              <button
                onClick={(e) => handleDeleteDM(channel.channelId, e)}
                className="text-red-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete conversation"
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