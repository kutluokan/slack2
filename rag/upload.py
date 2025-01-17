from langchain_openai import OpenAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_pinecone import PineconeVectorStore
from langchain_community.document_loaders.pdf import PyPDFLoader
from langchain_community.document_loaders import TextLoader, DirectoryLoader, UnstructuredFileLoader
from langchain.document_loaders import JSONLoader
import os
from dotenv import load_dotenv
import json
from typing import List, Dict
from fastapi import FastAPI, UploadFile, File, HTTPException
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
import logging
from pinecone import Pinecone

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
PINECONE_INDEX = os.getenv("PINECONE_INDEX")

if not all([PINECONE_API_KEY, OPENAI_API_KEY, PINECONE_INDEX]):
    logger.error("Missing required environment variables")
    raise ValueError("Missing required environment variables")

# Initialize Pinecone
try:
    pc = Pinecone(api_key=PINECONE_API_KEY)
    logger.info("Pinecone initialized")
    
    # Verify index exists
    active_indexes = pc.list_indexes().names()
    logger.info(f"Available Pinecone indexes: {active_indexes}")
    
    if PINECONE_INDEX not in active_indexes:
        logger.error(f"Index {PINECONE_INDEX} not found in available indexes")
        raise ValueError(f"Pinecone index {PINECONE_INDEX} not found")
        
except Exception as e:
    logger.error(f"Failed to initialize Pinecone: {str(e)}")
    raise

# Initialize embeddings
embeddings = OpenAIEmbeddings(
    model="text-embedding-3-large",
    openai_api_key=OPENAI_API_KEY
)

UPLOAD_DIR = '/app/uploads'
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

def get_loader_for_file(file_path: str):
    """Get the appropriate loader based on file extension."""
    ext = os.path.splitext(file_path)[1].lower()
    if ext == '.pdf':
        return PyPDFLoader(file_path)
    elif ext == '.txt':
        return TextLoader(file_path)
    else:
        return UnstructuredFileLoader(file_path)

def process_file(file_path: str) -> List[Dict]:
    """Process a single file and return chunks."""
    try:
        # Load the document
        loader = get_loader_for_file(file_path)
        raw_docs = loader.load()
        
        # Split documents into smaller chunks
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        documents = text_splitter.split_documents(raw_docs)
        
        logger.info(f"Processing {file_path}: Created {len(documents)} chunks")
        return documents
    except Exception as e:
        logger.error(f"Error processing {file_path}: {str(e)}")
        return []

@app.post("/process")
async def process_uploaded_file(file: UploadFile = File(...)):
    try:
        # Save the uploaded file
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Process the file
        documents = process_file(file_path)
        if not documents:
            return {"status": "error", "message": "No documents created from file"}
        
        # Upload to Pinecone
        vectorstore = PineconeVectorStore.from_documents(
            documents=documents,
            embedding=embeddings,
            index_name=PINECONE_INDEX,
            pinecone_api_key=PINECONE_API_KEY
        )
        
        return {
            "status": "success",
            "message": f"File processed and uploaded to vector store. Created {len(documents)} chunks.",
            "file_path": file_path
        }
    except Exception as e:
        logger.error(f"Error processing file: {str(e)}", exc_info=True)
        return {"status": "error", "message": str(e)}

@app.get("/health")
async def health_check():
    """Health check endpoint to verify the service is running"""
    return {"status": "healthy"}

@app.get("/")
async def root():
    """Root endpoint to verify the service is running"""
    return {"message": "Upload Service is running"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
