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
    </div>
  );
}; 