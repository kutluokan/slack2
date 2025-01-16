import { useState, useEffect } from 'react';
import { socket } from '../config/socket';
import { FaCircle } from 'react-icons/fa';
import { getDatabase, ref, onValue, off } from 'firebase/database';

interface User {
  userId: string;
  email: string;
  displayName?: string;
  photoURL?: string;
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
  const [users, setUsers] = useState<User[]>([]);
  const [presenceStatuses, setPresenceStatuses] = useState<{[key: string]: {status: string}}>({});

  useEffect(() => {
    if (currentUser?.uid) {
      socket.emit('get_users');

      const handleUsers = (userList: User[]) => {
        // Filter out current user from the list
        const filteredUsers = userList.filter(user => user.userId !== currentUser.uid);
        setUsers(filteredUsers);
        console.log('Users received:', filteredUsers);

        // Set up presence listeners for each user
        const db = getDatabase();
        filteredUsers.forEach(user => {
          const userPresenceRef = ref(db, `presence/${user.userId}`);
          onValue(userPresenceRef, (snapshot) => {
            const presenceData = snapshot.val();
            console.log(`Presence update for ${user.userId}:`, presenceData);
            setPresenceStatuses(prev => ({
              ...prev,
              [user.userId]: presenceData || { status: 'offline' }
            }));
          });
        });
      };

      socket.on('users', handleUsers);

      return () => {
        socket.off('users', handleUsers);
        // Clean up presence listeners
        const db = getDatabase();
        users.forEach(user => {
          const userPresenceRef = ref(db, `presence/${user.userId}`);
          off(userPresenceRef);
        });
      };
    }
  }, [currentUser?.uid]);

  const getStatusColor = (userId: string) => {
    const userPresence = presenceStatuses[userId];
    console.log(`Getting status for user ${userId}:`, userPresence);
    const status = userPresence?.status || 'offline';

    switch (status) {
      case 'online':
        return 'text-green-500';
      case 'away':
        return 'text-yellow-500';
      case 'offline':
      default:
        return 'text-gray-500';
    }
  };

  const handleUserSelect = (user: User) => {
    const channelId = `dm_${[currentUser.uid, user.userId].sort().join('_')}`;
    onChannelSelect({
      id: channelId,
      name: user.displayName || user.email,
    });
  };

  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold mb-2 px-2">Direct Messages</h2>
      <ul className="space-y-1">
        {users.map((user) => {
          const status = presenceStatuses[user.userId]?.status || 'offline';
          console.log(`Rendering user ${user.email} with status:`, status);
          return (
            <li
              key={user.userId}
              onClick={() => handleUserSelect(user)}
              className={`flex items-center space-x-2 px-2 py-1 cursor-pointer hover:bg-gray-700 rounded ${
                selectedChannelId === `dm_${[currentUser.uid, user.userId].sort().join('_')}` ? 'bg-gray-700' : ''
              }`}
            >
              <FaCircle className={`w-2 h-2 ${getStatusColor(user.userId)}`} />
              <span>{user.displayName || user.email}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}; 