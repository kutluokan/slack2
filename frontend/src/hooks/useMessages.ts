import { useEffect, useState } from 'react';
import { socket } from '../config/socket';

export interface Message {
  messageId: string;
  channelId: string;
  timestamp: number;
  userId: string;
  content: string;
  username: string;
  reactions?: { [key: string]: string[] };
  parentMessageId?: string;
  fileAttachment?: {
    fileName: string;
    fileType: string;
    fileSize: number;
    fileUrl: string;
    s3Key: string;
  };
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
    if (channelId && channelId !== '') {
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

      socket.on('message_deleted', (messageId: string) => {
        setMessages(prev => prev.filter(msg => msg.messageId !== messageId));
      });

      return () => {
        socket.off('messages');
        socket.off('message');
        socket.off('reaction_added');
        socket.off('message_deleted');
        if (channelId) {
          socket.emit('leave_channel', channelId);
        }
      };
    } else {
      setMessages([]);
    }
  }, [channelId]);

  const sendMessage = (
    content: string, 
    userId: string, 
    username: string, 
    fileAttachment?: {
      fileName: string;
      fileType: string;
      fileSize: number;
      fileUrl: string;
      s3Key: string;
    }
  ) => {
    if (!channelId) return;

    const messageData = {
      channelId,
      userId,
      content,
      username,
      fileAttachment
    };

    if (fileAttachment) {
      socket.emit('message_with_file', messageData);
    } else {
      socket.emit('message', messageData);
    }
  };

  const addReaction = (messageId: string, emoji: string) => {
    if (!socket.auth?.userId || !channelId) {
      console.error('User not authenticated or no channel selected');
      return;
    }
    socket.emit('add_reaction', { 
      messageId, 
      emoji,
      userId: socket.auth.userId 
    });
  };

  const deleteMessage = (messageId: string) => {
    if (!channelId) return;
    socket.emit('delete_message', { messageId });
  };

  return { messages, sendMessage, addReaction, deleteMessage };
}; 