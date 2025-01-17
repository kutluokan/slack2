import { useEffect } from 'react';
import { Message as MessageType } from '../hooks/useMessages';
import { Message } from './Message';
import { MessageInput } from './MessageInput';
import { FaTimes } from 'react-icons/fa';
import { socket } from '../config/socket';

interface ThreadProps {
  parentMessage: MessageType | null;
  threadMessages: MessageType[];
  onClose: () => void;
  onSendMessage: (content: string, userId: string, username: string, fileAttachment?: {
    fileName: string;
    fileType: string;
    fileSize: number;
    fileUrl: string;
    s3Key: string;
  }) => void;
  onReactionAdd: (messageId: string, emoji: string) => void;
  onDelete: (messageId: string) => void;
  currentUser: {
    uid: string;
    displayName?: string | null;
    email: string | null;
  };
  onParentMessageUpdate?: (updatedMessage: MessageType) => void;
}

interface ThreadMessagesPayload {
  parentMessageId: string;
  messages: MessageType[];
}

export const Thread = ({
  parentMessage,
  threadMessages,
  onClose,
  onSendMessage,
  onReactionAdd,
  onDelete,
  currentUser,
  onParentMessageUpdate
}: ThreadProps) => {
  useEffect(() => {
    if (parentMessage) {
      // Request thread messages when the thread is opened
      socket.emit('get_thread_messages', parentMessage.messageId);

      // Listen for thread updates
      socket.on('thread_messages', ({ messages }: ThreadMessagesPayload) => {
        // The parent component will handle updating the messages
        console.log('Received thread messages:', messages);
      });

      // Listen for parent message updates
      socket.on('message_updated', (updatedMessage: MessageType) => {
        if (updatedMessage.messageId === parentMessage.messageId) {
          // Update the parent message in the parent component
          onParentMessageUpdate?.(updatedMessage);
        }
      });

      return () => {
        socket.off('thread_messages');
        socket.off('message_updated');
      };
    }
  }, [parentMessage]);

  if (!parentMessage) return null;

  const handleSendMessage = (
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
    onSendMessage(content, userId, username, fileAttachment);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Thread Header */}
      <div className="h-16 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 flex-shrink-0">
        <h3 className="text-lg font-semibold">Thread</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <FaTimes size={20} />
        </button>
      </div>

      {/* Parent Message */}
      <div className="border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <Message
          message={parentMessage}
          isGrouped={false}
          onReactionAdd={onReactionAdd}
          onThreadReply={() => {}} // No-op since we're already in the thread
          onDelete={onDelete}
        />
      </div>

      {/* Thread Messages */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4">
        {threadMessages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-4">
            No replies yet. Start a conversation!
          </div>
        ) : (
          threadMessages.map((message, index) => (
            <Message
              key={message.messageId}
              message={message}
              isGrouped={index > 0 && threadMessages[index - 1].userId === message.userId}
              onReactionAdd={onReactionAdd}
              onThreadReply={() => {}} // No-op since we're already in the thread
              onDelete={onDelete}
            />
          ))
        )}
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
        <MessageInput
          onSendMessage={handleSendMessage}
          currentUser={currentUser}
        />
      </div>
    </div>
  );
}; 