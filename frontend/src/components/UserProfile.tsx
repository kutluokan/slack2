import React from 'react';
import Image from 'next/image';
import { PresenceIndicator } from './PresenceIndicator';

interface UserProfileProps {
  user: {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
  };
}

export const UserProfile: React.FC<UserProfileProps> = ({ user }) => {
  return (
    <div className="flex items-center p-4 border-b border-gray-700">
      <div className="flex items-center space-x-3">
        {user.photoURL ? (
          <Image
            src={user.photoURL}
            alt={user.displayName || 'User'}
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : (
          <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm">
              {(user.displayName || user.email || 'U')[0].toUpperCase()}
            </span>
          </div>
        )}
        <div>
          <div className="text-sm font-medium text-white">
            {user.displayName || 'Anonymous'}
          </div>
          <PresenceIndicator userId={user.uid} />
        </div>
      </div>
    </div>
  );
}; 