socket.on('delete_message', async ({ messageId }) => {
  try {
    await messageService.deleteMessage(messageId);
    socket.to(channelId).emit('message_deleted', messageId);
    socket.emit('message_deleted', messageId);
  } catch (error) {
    console.error('Error deleting message:', error);
  }
}); 