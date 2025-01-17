from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from langchain_openai import ChatOpenAI
from langchain.prompts.prompt import PromptTemplate
from langchain_pinecone import PineconeVectorStore
from langchain_openai import OpenAIEmbeddings
import os
from dotenv import load_dotenv
from typing import List, Dict
import uvicorn

load_dotenv()

# Load environment variables
os.environ["PINECONE_API_KEY"] = os.getenv("PINECONE_API_KEY")
os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY")
os.environ["LANGCHAIN_API_KEY"] = os.getenv("LANGCHAIN_API_KEY")
os.environ["LANGCHAIN_TRACING_V2"] = os.getenv("LANGCHAIN_TRACING_V2")
os.environ["LANGCHAIN_PROJECT"] = os.getenv("LANGCHAIN_PROJECT")
PINECONE_INDEX = os.getenv("PINECONE_INDEX")

app = FastAPI()

class ChatMessage(BaseModel):
    role: str
    content: str

class RagRequest(BaseModel):
    prompt: str
    chat_history: List[ChatMessage] = []

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
        # Initialize embeddings
        embeddings = OpenAIEmbeddings(model="text-embedding-3-large")
        
        # Query the vector database
        document_vectorstore = PineconeVectorStore(index_name=PINECONE_INDEX, embedding=embeddings)
        retriever = document_vectorstore.as_retriever()
        relevant_docs = retriever.invoke(prompt)
        
        # Format document context
        doc_context = "\n\n".join([
            f"Source: {doc.metadata['source']}\nContent: {doc.page_content}"
            for doc in relevant_docs
        ])
        
        # Format chat history context if provided
        chat_context = ""
        if chat_history:
            chat_context = "\n".join([
                f"{msg['role']}: {msg['content']}"
                for msg in chat_history[-5:]  # Include last 5 messages for context
            ])
        
        # Create prompt template with both document and chat context
        template = """Please answer the following question using the provided context from both documents and chat history.

Question: {query}

Relevant Documents:
{doc_context}

Chat History:
{chat_context}

Please provide a concise answer based on the above context."""

        prompt_template = PromptTemplate(
            template=template,
            input_variables=["query", "doc_context", "chat_context"]
        )
        
        # Generate the full prompt
        full_prompt = prompt_template.invoke({
            "query": prompt,
            "doc_context": doc_context,
            "chat_context": chat_context
        })
        
        # Get response from LLM
        llm = ChatOpenAI(temperature=0.7, model_name="gpt-4o-mini")
        response = llm.invoke(full_prompt)
        
        return response.content
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate")
async def generate_response(request: RagRequest):
    try:
        chat_history = [dict(msg) for msg in request.chat_history]
        response = await get_rag_response(request.prompt, chat_history)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)