import { useState } from 'react';

interface MessageProps {
  message: {
    messageId: string;
    content: string;
    userId: string;
    username: string;
    timestamp: number;
    reactions?: { [key: string]: string[] }; // emoji: userId[]
  };
  isGrouped?: boolean;
  onReactionAdd: (messageId: string, emoji: string) => void;
  onThreadReply: (messageId: string) => void;
}

export const Message = ({ message, isGrouped, onReactionAdd, onThreadReply }: MessageProps) => {
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const commonEmojis = ['👍', '❤️', '😂', '🎉', '🤔', '👀'];

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div 
      className="group px-4 py-1 hover:bg-gray-50 dark:hover:bg-gray-800"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {!isGrouped && (
        <div className="flex items-baseline mb-1">
          <span className="font-bold mr-2">{message.username}</span>
          <span className="text-xs text-gray-500">
            {formatTime(message.timestamp)}
          </span>
        </div>
      )}
      
      <div className="flex items-start">
        {isGrouped && <div className="w-10" />}
        <div className="flex-1">
          <p className="text-sm">{message.content}</p>
          
          {/* Reactions */}
          {message.reactions && Object.entries(message.reactions).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(message.reactions).map(([emoji, users]) => (
                <button
                  key={emoji}
                  onClick={() => onReactionAdd(message.messageId, emoji)}
                  className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 
                    dark:bg-gray-700 text-sm hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  <span>{emoji}</span>
                  <span className="ml-1">{users.length}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Message Actions */}
        {showActions && (
          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              😊
            </button>
            <button
              onClick={() => onThreadReply(message.messageId)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              🧵
            </button>
          </div>
        )}
      </div>

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div className="absolute mt-1 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-2 z-10">
          <div className="flex gap-2">
            {commonEmojis.map(emoji => (
              <button
                key={emoji}
                onClick={() => {
                  if (message.messageId) {
                    onReactionAdd(message.messageId, emoji);
                    setShowEmojiPicker(false);
                  }
                }}
                className="hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 