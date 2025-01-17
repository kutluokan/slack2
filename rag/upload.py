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
from fastapi import FastAPI, UploadFile, File
import uvicorn

app = FastAPI()

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

load_dotenv()

os.environ["PINECONE_API_KEY"] = os.getenv("PINECONE_API_KEY")
os.environ["LANGCHAIN_API_KEY"] = os.getenv("LANGCHAIN_API_KEY")
os.environ["LANGCHAIN_TRACING_V2"] = os.getenv("LANGCHAIN_TRACING_V2")
os.environ["LANGCHAIN_PROJECT"] = os.getenv("LANGCHAIN_PROJECT")
PINECONE_INDEX = os.getenv("PINECONE_INDEX")

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
        
        print(f"Processing {file_path}: Created {len(documents)} chunks")
        return documents
    except Exception as e:
        print(f"Error processing {file_path}: {str(e)}")
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
        embeddings = OpenAIEmbeddings(model="text-embedding-3-large")
        PineconeVectorStore.from_documents(
            documents=documents,
            embedding=embeddings,
            index_name=PINECONE_INDEX
        )
        
        return {
            "status": "success",
            "message": f"File processed and uploaded to vector store. Created {len(documents)} chunks.",
            "file_path": file_path
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)
