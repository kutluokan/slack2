import { Message } from './Message';
import type { Message as MessageType } from '../hooks/useMessages';

interface MessageGroupProps {
  messages: MessageType[];
  onDelete: (messageId: string) => void;
  onReactionAdd: (messageId: string, emoji: string) => void;
  onThreadReply: (messageId: string) => void;
}

export const MessageGroup = ({ messages, onDelete, onReactionAdd, onThreadReply }: MessageGroupProps) => {
  if (!messages.length) return null;

  return (
    <div className="group py-2 hover:bg-gray-50">
      {messages.map((message, index) => (
        <Message
          key={message.messageId}
          message={message}
          isGrouped={index > 0}
          onReactionAdd={onReactionAdd}
          onThreadReply={onThreadReply}
          onDelete={onDelete}
        />
      ))}
      <div className="hidden group-hover:flex items-center gap-2 mt-1 ml-1">
        <button className="text-xs text-gray-500 hover:text-gray-700">
          Reply
        </button>
        <button className="text-xs text-gray-500 hover:text-gray-700">
          React
        </button>
      </div>
    </div>
  );
}; 