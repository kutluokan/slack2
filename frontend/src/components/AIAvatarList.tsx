import { useState } from 'react';

interface AIAvatarListProps {
  onUserSelect: (userId: string) => void;
}

export const AIAvatarList = ({ onUserSelect }: AIAvatarListProps) => {
  return (
    <div className="mt-6">
      <div 
        className="flex items-center px-4 py-2 cursor-pointer hover:bg-gray-700"
        onClick={() => onUserSelect('kay-ai-avatar')}
      >
        <h2 className="text-lg font-semibold text-gray-300">Kay&apos;s AI Avatar</h2>
      </div>
    </div>
  );
}; 