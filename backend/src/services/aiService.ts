import OpenAI from 'openai';
import dotenv from 'dotenv';
import axios, { AxiosError } from 'axios';

dotenv.config();

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is required in environment variables');
}

const RAG_SERVICE_URL = process.env.RAG_QUERY_URL || 'http://rag_query:8001';
console.log(`RAG service URL: ${RAG_SERVICE_URL}`);

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface RagResponse {
  response: string;
}

// Verify RAG service is available
const checkRagService = async () => {
  try {
    const response = await axios.get(RAG_SERVICE_URL);
    console.log('RAG service health check response:', response.data);
    return true;
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error('RAG service health check failed:', axiosError.message);
    return false;
  }
};

// Initialize by checking RAG service
checkRagService().then(isAvailable => {
  console.log(`RAG service is ${isAvailable ? 'available' : 'not available'}`);
});

export const aiService = {
  async generateResponse(messages: ChatMessage[]): Promise<string> {
    try {
      // Get the last message as the prompt
      const lastMessage = messages[messages.length - 1];
      
      // Use previous messages as chat history
      const chatHistory = messages.slice(0, -1);

      console.log(`Sending request to RAG service at ${RAG_SERVICE_URL}/generate`);
      const payload = {
        prompt: lastMessage.content,
        chat_history: chatHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      };
      console.log('Request payload:', JSON.stringify(payload, null, 2));

      // Call the RAG service
      const response = await axios.post<RagResponse>(`${RAG_SERVICE_URL}/generate`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });

      console.log('RAG service response:', response.data);
      
      if (!response.data || !response.data.response) {
        throw new Error('Invalid response from RAG service');
      }
      
      return response.data.response;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Error generating AI response:', {
        error: axiosError.message,
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        data: axiosError.response?.data,
        url: axiosError.config?.url,
        method: axiosError.config?.method,
        headers: axiosError.config?.headers
      });
      
      // Fallback to OpenAI direct call if RAG service fails
      console.log('Falling back to direct OpenAI call');
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature: 0.7,
        max_tokens: 500
      });

      return completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
    }
  }
}; 