import { Socket } from 'socket.io';
import { messageService } from '../services/messageService';

export const handleMessageEvents = (socket: Socket) => {
  socket.on('delete_message', async ({ messageId, channelId }: { messageId: string, channelId: string }) => {
    try {
      await messageService.deleteMessage(messageId);
      socket.to(channelId).emit('message_deleted', messageId);
      socket.emit('message_deleted', messageId);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  });
}; 