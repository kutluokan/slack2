import { useMemo, useEffect, useRef, useState } from 'react';
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
  onDelete: (messageId: string) => void;
}

export const MessageList = ({ messages, onReactionAdd, onThreadReply, onDelete }: MessageListProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  const groupedMessages = useMemo(() => {
    // Sort messages by timestamp to ensure newest is at bottom
    const sortedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);
    return sortedMessages.reduce((acc, message, index) => {
      const prevMessage = sortedMessages[index - 1];
      const isGrouped = prevMessage && 
        prevMessage.userId === message.userId &&
        message.timestamp - prevMessage.timestamp < 300000; // 5 minutes

      return [...acc, { ...message, isGrouped }];
    }, [] as Array<typeof messages[0] & { isGrouped?: boolean }>);
  }, [messages]);

  // Initial scroll to bottom when messages are first loaded
  useEffect(() => {
    if (isFirstLoad && messages.length > 0) {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView();
      }
      setIsFirstLoad(false);
    }
  }, [messages, isFirstLoad]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    const scrollToBottom = () => {
      if (!userHasScrolled && messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    };

    scrollToBottom();
  }, [messages, userHasScrolled]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    
    const { scrollHeight, clientHeight, scrollTop } = containerRef.current;
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50;
    
    if (!isAtBottom) {
      setUserHasScrolled(true);
    } else {
      setUserHasScrolled(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="flex flex-col space-y-1 overflow-y-auto h-full"
    >
      {groupedMessages.map((message) => (
        <Message
          key={message.messageId}
          message={message}
          isGrouped={message.isGrouped}
          onReactionAdd={onReactionAdd}
          onThreadReply={onThreadReply}
          onDelete={onDelete}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}; 