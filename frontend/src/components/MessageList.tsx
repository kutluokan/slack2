import { useMemo, useEffect, useRef, useState } from 'react';
import { MessageGroup } from './MessageGroup';
import type { Message as MessageType } from '../hooks/useMessages';

interface MessageListProps {
  messages: MessageType[];
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
    
    // Group messages by user and time proximity
    const groups: typeof messages[] = [];
    let currentGroup: typeof messages = [];
    
    sortedMessages.forEach((message, index) => {
      const prevMessage = sortedMessages[index - 1];
      
      if (prevMessage && 
          prevMessage.userId === message.userId &&
          message.timestamp - prevMessage.timestamp < 300000) { // 5 minutes
        currentGroup.push(message);
      } else {
        if (currentGroup.length > 0) {
          groups.push([...currentGroup]);
        }
        currentGroup = [message];
      }
    });
    
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups;
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
      {groupedMessages.map((group) => (
        <MessageGroup
          key={group[0].messageId}
          messages={group}
          onDelete={onDelete}
          onReactionAdd={onReactionAdd}
          onThreadReply={onThreadReply}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}; 