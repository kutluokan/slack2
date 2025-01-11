import { useMemo } from 'react';
import { Message } from './Message';

interface MessageListProps {
  messages: Array<{
    messageId: string;
    content: string;
    userId: string;
    username: string;
    timestamp: number;
    reactions?: { [key: string]: string[] };
  }>;
  onReactionAdd: (messageId: string, emoji: string) => void;
  onThreadReply: (messageId: string) => void;
}

export const MessageList = ({ messages, onReactionAdd, onThreadReply }: MessageListProps) => {
  const groupedMessages = useMemo(() => {
    return messages.reduce((acc, message, index) => {
      const prevMessage = messages[index - 1];
      const isGrouped = prevMessage && 
        prevMessage.userId === message.userId &&
        message.timestamp - prevMessage.timestamp < 300000; // 5 minutes

      return [...acc, { ...message, isGrouped }];
    }, [] as Array<typeof messages[0] & { isGrouped?: boolean }>);
  }, [messages]);

  return (
    <div className="flex flex-col space-y-1">
      {groupedMessages.map((message) => (
        <Message
          key={message.messageId}
          message={message}
          isGrouped={message.isGrouped}
          onReactionAdd={onReactionAdd}
          onThreadReply={onThreadReply}
        />
      ))}
    </div>
  );
}; 