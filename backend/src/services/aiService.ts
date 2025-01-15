import OpenAI from 'openai';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is required in environment variables');
}

const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://rag_app:8000';

export const aiService = {
  async generateResponse(messages: { role: 'user' | 'assistant', content: string }[]) {
    try {
      // Get the last message as the prompt
      const lastMessage = messages[messages.length - 1];
      
      // Use previous messages as chat history
      const chatHistory = messages.slice(0, -1);

      // Call the RAG service
      const response = await axios.post(`${RAG_SERVICE_URL}/generate`, {
        prompt: lastMessage.content,
        chat_history: chatHistory
      });

      return response.data.response;
    } catch (error) {
      console.error('Error generating AI response:', error);
      
      // Fallback to OpenAI direct call if RAG service fails
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: messages,
        temperature: 0.7,
        max_tokens: 500
      });

      return completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
    }
  }
}; 