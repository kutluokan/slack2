import { useEffect, useState } from 'react';
import { socket } from '../config/socket';

interface Message {
  channelId: string;
  timestamp: number;
  userId: string;
  content: string;
  username: string;
}

export const useMessages = (channelId: string) => {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    // Join channel
    socket.emit('join_channel', channelId);
    
    // Get existing messages
    socket.emit('get_messages', channelId);

    // Listen for messages
    socket.on('messages', (channelMessages: Message[]) => {
      setMessages(channelMessages);
    });

    socket.on('message', (newMessage: Message) => {
      setMessages(prev => [...prev, newMessage]);
    });

    return () => {
      socket.off('messages');
      socket.off('message');
    };
  }, [channelId]);

  const sendMessage = (content: string, userId: string, username: string) => {
    const messageData: Omit<Message, 'timestamp'> = {
      channelId,
      userId,
      content,
      username,
    };
    socket.emit('message', messageData);
  };

  return { messages, sendMessage };
}; 