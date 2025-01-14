from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from langchain_openai import ChatOpenAI
from langchain.prompts.prompt import PromptTemplate
from langchain_pinecone import PineconeVectorStore
from langchain_openai import OpenAIEmbeddings
import os
from dotenv import load_dotenv
import uvicorn

load_dotenv()

# Environment variables setup
os.environ["PINECONE_API_KEY"] = os.getenv("PINECONE_API_KEY")
os.environ["LANGCHAIN_API_KEY"] = os.getenv("LANGCHAIN_API_KEY")
os.environ["LANGCHAIN_TRACING_V2"] = os.getenv("LANGCHAIN_TRACING_V2")
os.environ["LANGCHAIN_PROJECT"] = os.getenv("LANGCHAIN_PROJECT")
PINECONE_INDEX = os.getenv("PINECONE_INDEX")

# Initialize FastAPI app
app = FastAPI()

# Initialize AI components
embeddings = OpenAIEmbeddings(model="text-embedding-3-large")
document_vectorstore = PineconeVectorStore(index_name=PINECONE_INDEX, embedding=embeddings)
retriever = document_vectorstore.as_retriever()

# DO NOT CHANGE THE MODEL NAME. IT MUST BE gpt-4o-mini.
llm = ChatOpenAI(temperature=0.7, model_name="gpt-4o-mini")

class Message(BaseModel):
    content: str

@app.post("/chat")
async def chat(message: Message):
    try:
        # Get context from vector store
        context = retriever.invoke(message.content)
        
        # Create prompt with context
        template = PromptTemplate(
            template="{query} Context: {context}", 
            input_variables=["query", "context"]
        )
        prompt_with_context = template.invoke({
            "query": message.content, 
            "context": context
        })
        
        # Get AI response
        response = llm.invoke(prompt_with_context)
        
        return {"response": response.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
