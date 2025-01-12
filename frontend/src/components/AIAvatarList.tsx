import { useState, useEffect } from 'react';
import { socket } from '../config/socket';

interface User {
  userId: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}

interface AIAvatarListProps {
  currentUser: {
    uid: string;
    email: string | null;
  };
  onUserSelect: (userId: string) => void;
  selectedUserId: string | null;
}

export const AIAvatarList = ({ currentUser, onUserSelect, selectedUserId }: AIAvatarListProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (currentUser?.uid) {
      socket.emit('get_users');

      const handleUsers = (userList: User[]) => {
        // Filter out current user
        setUsers(userList.filter(user => user.userId !== currentUser.uid));
      };

      socket.on('users', handleUsers);

      return () => {
        socket.off('users', handleUsers);
      };
    }
  }, [currentUser?.uid]);

  return (
    <div className="mt-6">
      <div 
        className="flex items-center justify-between px-4 mb-2 cursor-pointer"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h2 className="text-lg font-semibold text-gray-300">AI Avatars</h2>
        <span className="text-gray-400">
          {isCollapsed ? '▼' : '▲'}
        </span>
      </div>

      {!isCollapsed && (
        <ul className="space-y-1">
          {users.map((user) => (
            <li
              key={user.userId}
              onClick={() => onUserSelect(user.userId)}
              className={`px-4 py-1 text-gray-300 hover:bg-gray-700 cursor-pointer ${
                selectedUserId === user.userId ? 'bg-gray-700' : ''
              }`}
            >
              @ {user.displayName || user.email}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}; 