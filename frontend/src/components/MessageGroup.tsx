import { Message } from './Message';

interface MessageData {
  messageId: string;
  channelId: string;
  timestamp: number;
  userId: string;
  content: string;
  username: string;
  reactions?: { [key: string]: string[] };
}

interface MessageGroupProps {
  messages: MessageData[];
}

export const MessageGroup = ({ messages }: MessageGroupProps) => {
  if (!messages.length) return null;

  return (
    <div className="group py-2 hover:bg-gray-50">
      {messages.map((message, index) => (
        <Message
          key={message.timestamp}
          message={message}
          isGrouped={index > 0}
          onReactionAdd={() => {}}
          onThreadReply={() => {}}
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