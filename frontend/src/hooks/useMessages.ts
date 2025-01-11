import { useEffect, useState } from 'react';
import { socket } from '../config/socket';

interface Message {
  messageId: string;
  channelId: string;
  timestamp: number;
  userId: string;
  content: string;
  username: string;
  reactions?: { [key: string]: string[] };
  parentMessageId?: string;
}

interface ReactionPayload {
  messageId: string;
  emoji: string;
  userId: string;
  reactions: { [key: string]: string[] };
}

export const useMessages = (channelId: string) => {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    socket.emit('join_channel', channelId);
    socket.emit('get_messages', channelId);

    socket.on('messages', (channelMessages: Message[]) => {
      setMessages(channelMessages);
    });

    socket.on('message', (newMessage: Message) => {
      setMessages(prev => [...prev, newMessage]);
    });

    socket.on('reaction_added', ({ messageId, reactions }: Pick<ReactionPayload, 'messageId' | 'reactions'>) => {
      setMessages(prev => prev.map(msg => {
        if (msg.messageId === messageId) {
          return {
            ...msg,
            reactions: reactions
          };
        }
        return msg;
      }));
    });

    return () => {
      socket.off('messages');
      socket.off('message');
      socket.off('reaction_added');
    };
  }, [channelId]);

  const sendMessage = (content: string, userId: string, username: string, parentMessageId?: string) => {
    const messageData = {
      channelId,
      userId,
      content,
      username,
      parentMessageId
    };
    socket.emit('message', messageData);
  };

  const addReaction = (messageId: string, emoji: string) => {
    socket.emit('add_reaction', { messageId, emoji });
  };

  return { messages, sendMessage, addReaction };
}; 