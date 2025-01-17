import { useState, useRef, useEffect } from 'react';
import { FaTrash, FaDownload, FaVolumeUp } from 'react-icons/fa';
import Image from 'next/image';
import type { Message as MessageType } from '../hooks/useMessages';
import { socket } from '../config/socket';

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const handleTTSGenerated = (data: { messageId: string; audioData: string }) => {
      if (data.messageId === message.messageId) {
        // Convert base64 to blob and create URL
        const blob = new Blob([Buffer.from(data.audioData, 'base64')], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        // Play the audio
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play();
          setIsPlaying(true);
        }
      }
    };

    socket.on('tts_generated', handleTTSGenerated);

    return () => {
      socket.off('tts_generated', handleTTSGenerated);
      // Cleanup audio URL when component unmounts
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [message.messageId, audioUrl]);

  const handleTTSClick = () => {
    if (audioUrl && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    } else {
      socket.emit('request_tts', message.messageId);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showEmojiPicker &&
          emojiPickerRef.current &&
          emojiButtonRef.current &&
          !emojiPickerRef.current.contains(event.target as Node) &&
          !emojiButtonRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

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
      id={message.messageId}
      className="group relative px-4 py-1 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Message Actions - Floating above - Only show for first message in group */}
      {!isGrouped && (
        <div className={`absolute -top-8 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white dark:bg-gray-800 shadow-lg rounded-md px-2 py-1 z-10`}>
          <button
            ref={emojiButtonRef}
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
            onClick={handleTTSClick}
            className={`${isPlaying ? 'text-blue-500' : 'text-gray-400'} hover:text-gray-600 dark:hover:text-gray-300`}
            title={isPlaying ? 'Stop' : 'Play'}
          >
            <FaVolumeUp size={14} />
          </button>
          <button
            onClick={() => onDelete(message.messageId)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <FaTrash size={14} />
          </button>
        </div>
      )}

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        className="hidden"
      />

      {/* Emoji Picker - Only show for first message in group */}
      {!isGrouped && showEmojiPicker && (
        <div 
          ref={emojiPickerRef}
          className="absolute -top-20 right-4 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-2 z-20"
        >
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

      {!isGrouped && (
        <div className="flex items-center mb-1">
          {message.photoURL && (
            <Image
              src={message.photoURL}
              alt={message.username}
              width={24}
              height={24}
              className="rounded-full mr-2"
            />
          )}
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

          {/* Thread Reply Count */}
          {message.threadMessageCount && message.threadMessageCount > 0 && (
            <button
              onClick={() => onThreadReply(message.messageId)}
              className="mt-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              {message.threadMessageCount} {message.threadMessageCount === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}; 