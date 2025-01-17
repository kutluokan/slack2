from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from langchain_openai import ChatOpenAI
from langchain.prompts.prompt import PromptTemplate
from langchain_pinecone import PineconeVectorStore
from langchain_openai import OpenAIEmbeddings
import os
from dotenv import load_dotenv
from typing import List, Dict, Optional
import uvicorn
import logging
from fastapi.middleware.cors import CORSMiddleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()
logger.info("Environment variables loaded")

# Load environment variables
os.environ["PINECONE_API_KEY"] = os.getenv("PINECONE_API_KEY")
os.environ["LANGCHAIN_API_KEY"] = os.getenv("LANGCHAIN_API_KEY")
os.environ["LANGCHAIN_TRACING_V2"] = os.getenv("LANGCHAIN_TRACING_V2")
os.environ["LANGCHAIN_PROJECT"] = os.getenv("LANGCHAIN_PROJECT")
PINECONE_INDEX = os.getenv("PINECONE_INDEX")

if not PINECONE_INDEX:
    logger.error("Missing required environment variables")
    raise ValueError("Missing required environment variables")

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests and their responses"""
    logger.info(f"Incoming {request.method} request to {request.url}")
    try:
        response = await call_next(request)
        logger.info(f"Response status code: {response.status_code}")
        return response
    except Exception as e:
        logger.error(f"Request failed: {str(e)}")
        raise

class ChatMessage(BaseModel):
    role: str
    content: str

class GenerateRequest(BaseModel):
    prompt: str
    chat_history: Optional[List[ChatMessage]] = []

class GenerateResponse(BaseModel):
    response: str

async def get_rag_response(prompt: str, chat_history: List[Dict[str, str]] = None) -> str:
    """
    Get a response using RAG capabilities.
    
    Args:
        prompt (str): The user's question or prompt
        chat_history (List[Dict[str, str]], optional): Previous chat messages
        
    Returns:
        str: The AI's response incorporating context from documents and chat
    """
    try:
        logger.info(f"Processing RAG request with prompt: {prompt}")
        
        # Initialize embeddings
        embeddings = OpenAIEmbeddings(model="text-embedding-3-large")
        logger.info("Embeddings model initialized")
        
        # Query the vector database
        document_vectorstore = PineconeVectorStore(index_name=PINECONE_INDEX, embedding=embeddings)
        retriever = document_vectorstore.as_retriever()
        logger.info("Querying Pinecone for relevant documents")
        context = retriever.invoke(prompt)
        
        if not context:
            logger.warning("No relevant documents found in Pinecone")
        else:
            logger.info(f"Found {len(context)} relevant documents")
            for doc in context:
                logger.info(f"Source: {doc.metadata.get('source', 'Unknown')}\nContent: {doc.page_content}\n")
        
        # Format chat history context if provided
        chat_context = ""
        if chat_history:
            chat_context = "\n".join([
                f"{msg['role']}: {msg['content']}"
                for msg in chat_history[-5:]  # Include last 5 messages for context
            ])
            logger.info(f"Including {len(chat_history[-5:])} messages from chat history")
        
        # Create prompt template with context
        template = PromptTemplate(
            template="{query} Context: {context}",
            input_variables=["query", "context"]
        )
        
        # Generate the full prompt
        prompt_with_context = template.invoke({
            "query": prompt,
            "context": context
        })
        
        # Get response from LLM
        logger.info("Initializing ChatOpenAI")
        llm = ChatOpenAI(temperature=0.7, model_name="gpt-4")
        logger.info("Generating response from LLM")
        response = llm.invoke(prompt_with_context)
        
        logger.info("Successfully generated response")
        return response.content
        
    except Exception as e:
        logger.error(f"Error in get_rag_response: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate", response_model=GenerateResponse)
async def generate_response(request: GenerateRequest):
    """
    Generate a response using RAG capabilities.
    
    Args:
        request (GenerateRequest): The request containing prompt and chat history
        
    Returns:
        GenerateResponse: The response containing the generated text
    """
    try:
        logger.info(f"Received generate request with prompt: {request.prompt}")
        logger.info(f"Chat history length: {len(request.chat_history)}")
        
        # Convert Pydantic models to dictionaries
        chat_history = [{"role": msg.role, "content": msg.content} for msg in request.chat_history]
        
        # Get RAG response
        response = await get_rag_response(request.prompt, chat_history)
        logger.info("Successfully processed generate request")
        
        return GenerateResponse(response=response)
    except Exception as e:
        logger.error(f"Error in generate_response endpoint: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    """Root endpoint to verify the service is running"""
    return {"message": "RAG Service is running"}

@app.get("/health")
async def health_check():
    """Health check endpoint to verify the service is running"""
    return {"status": "healthy"}

if __name__ == "__main__":
    logger.info("Starting RAG service on port 8001")
    uvicorn.run(app, host="0.0.0.0", port=8001)