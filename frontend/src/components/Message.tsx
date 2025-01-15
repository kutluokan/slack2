import { useState } from 'react';
import { FaTrash, FaDownload } from 'react-icons/fa';
import type { Message as MessageType } from '../hooks/useMessages';

interface MessageProps {
  message: MessageType;
  isGrouped?: boolean;
  onReactionAdd: (messageId: string, emoji: string) => void;
  onThreadReply: (messageId: string) => void;
  onDelete: (messageId: string) => void;
}

export const Message = ({ message, isGrouped, onReactionAdd, onThreadReply, onDelete }: MessageProps) => {
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const commonEmojis = ['👍', '❤️', '😂', '🎉', '🤔', '👀'];

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
        <div className="flex-1">
          <p className="text-sm">{message.content}</p>
          
          {/* File Attachment */}
          {message.fileAttachment && (
            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="text-gray-500 dark:text-gray-300">
                    <FaDownload size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{message.fileAttachment.fileName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(message.fileAttachment.fileSize)}
                    </p>
                  </div>
                </div>
                <a
                  href={message.fileAttachment.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                  Download
                </a>
              </div>
            </div>
          )}
          
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
                  <span className="ml-1">{(users as string[]).length}</span>
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
            <button
              onClick={() => onDelete(message.messageId)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <FaTrash size={14} />
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