import { useState, useEffect, useRef } from 'react';
import { socket } from '../config/socket';
import { FaCircle, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { getDatabase, ref, onValue, off } from 'firebase/database';
import Image from 'next/image';

interface User {
  userId: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  isSystemUser?: boolean;
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
  const [isSelectingUser, setIsSelectingUser] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setIsSelectingUser(false);
        setSearchQuery('');
      }
    };

    if (isSelectingUser) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSelectingUser]);

  useEffect(() => {
    if (currentUser?.uid) {
      socket.emit('get_mentionable_users');

      const handleUsers = (userList: User[]) => {
        // Filter out current user from the list
        const filteredUsers = userList.filter(user => user.userId !== currentUser.uid);
        setUsers(filteredUsers);
        console.log('Users received:', filteredUsers);

        // Set up presence listeners for each user
        const db = getDatabase();
        filteredUsers.forEach(user => {
          // Only set up presence for non-AI users
          if (!user.isSystemUser) {
            const userPresenceRef = ref(db, `presence/${user.userId}`);
            onValue(userPresenceRef, (snapshot) => {
              const presenceData = snapshot.val();
              console.log(`Presence update for ${user.userId}:`, presenceData);
              setPresenceStatuses(prev => ({
                ...prev,
                [user.userId]: presenceData || { status: 'offline' }
              }));
            });
          } else {
            // AI users are always online
            setPresenceStatuses(prev => ({
              ...prev,
              [user.userId]: { status: 'online' }
            }));
          }
        });
      };

      socket.on('mentionable_users', handleUsers);

      return () => {
        socket.off('mentionable_users', handleUsers);
        // Clean up presence listeners
        const db = getDatabase();
        users.forEach(user => {
          if (!user.isSystemUser) {
            const userPresenceRef = ref(db, `presence/${user.userId}`);
            off(userPresenceRef);
          }
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
    setIsSelectingUser(false);
    setSearchQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsSelectingUser(false);
      setSearchQuery('');
    }
  };

  const filteredUsers = users.filter(user => {
    const searchText = (user.displayName || user.email || '').toLowerCase();
    return searchText.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-2 px-2">
        <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setIsCollapsed(!isCollapsed)}>
          {isCollapsed ? <FaChevronRight /> : <FaChevronDown />}
          <h2 className="text-lg font-semibold">Direct Messages</h2>
        </div>
        <button
          onClick={() => setIsSelectingUser(true)}
          className="text-sm bg-gray-700 px-2 py-1 rounded hover:bg-gray-600 text-white"
          title="Start DM"
        >
          +
        </button>
      </div>

      <div className={`${isCollapsed ? 'hidden' : 'block'}`}>
        {isSelectingUser && (
          <div className="relative">
            <div 
              ref={popupRef}
              className="absolute z-50 w-48 bg-gray-800 rounded-lg shadow-lg border border-gray-700 left-0" 
            >
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search users..."
                className="w-full px-2 py-1 text-sm text-black rounded-t mb-2"
                autoFocus
              />
              <div className="max-h-48 overflow-y-auto">
                {filteredUsers.map((user) => (
                  <div
                    key={user.userId}
                    onClick={() => handleUserSelect(user)}
                    className="flex items-center space-x-2 px-2 py-2 cursor-pointer hover:bg-gray-700"
                  >
                    <div className="relative">
                      {user.photoURL && (
                        <Image
                          src={user.photoURL}
                          alt={user.displayName || user.email}
                          width={24}
                          height={24}
                          className="rounded-full"
                        />
                      )}
                      <FaCircle className={`w-2 h-2 ${getStatusColor(user.userId)} absolute bottom-0 right-0`} />
                    </div>
                    <div className="flex flex-col">
                      <span>{user.displayName || user.email}</span>
                      {user.isSystemUser && (
                        <span className="text-xs text-blue-400">AI Assistant</span>
                      )}
                    </div>
                  </div>
                ))}
                {filteredUsers.length === 0 && (
                  <div className="px-2 py-2 text-gray-400">
                    No users found
                  </div>
                )}
              </div>
              <div className="p-2 border-t border-gray-700">
                <button
                  onClick={() => {
                    setIsSelectingUser(false);
                    setSearchQuery('');
                  }}
                  className="w-full px-2 py-1 text-sm bg-gray-600 rounded hover:bg-gray-500 text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

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
                <div className="relative">
                  {user.photoURL && (
                    <Image
                      src={user.photoURL}
                      alt={user.displayName || user.email}
                      width={24}
                      height={24}
                      className="rounded-full"
                    />
                  )}
                  <FaCircle className={`w-2 h-2 ${getStatusColor(user.userId)} absolute bottom-0 right-0`} />
                </div>
                <div className="flex flex-col">
                  <span>{user.displayName || user.email}</span>
                  {user.isSystemUser && (
                    <span className="text-xs text-blue-400">AI Assistant</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}; 