import React from 'react';
import { usePresence } from '../hooks/usePresence';
import { PresenceStatus } from '../store/slices/presenceSlice';
import { FaCircle } from 'react-icons/fa';

interface PresenceIndicatorProps {
  userId: string;
}

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({ userId }) => {
  const { status, updatePresence } = usePresence(userId);

  const getStatusColor = (status: PresenceStatus) => {
    switch (status) {
      case 'online':
        return 'text-green-500';
      case 'away':
        return 'text-yellow-500';
      case 'offline':
        return 'text-gray-500';
      default:
        return 'text-gray-500';
    }
  };

  const handleStatusChange = (newStatus: PresenceStatus) => {
    updatePresence(newStatus);
  };

  return (
    <div className="flex items-center space-x-2 px-2 py-2 bg-gray-700 rounded-md">
      <FaCircle className={`w-3 h-3 ${getStatusColor(status)}`} />
      <select
        value={status}
        onChange={(e) => handleStatusChange(e.target.value as PresenceStatus)}
        className="bg-gray-700 text-white text-sm focus:outline-none cursor-pointer"
      >
        <option value="online">Online</option>
        <option value="away">Away</option>
        <option value="offline">Offline</option>
      </select>
    </div>
  );
}; 