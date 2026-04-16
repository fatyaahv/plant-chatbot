from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from dotenv import load_dotenv
import json
import uuid
import os
from predict import predict_disease

# Load environment variables
load_dotenv()

# Get API key from .env
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY is None:
    raise ValueError("GEMINI_API_KEY not found. Please add it to your .env file")

# Configure Gemini
genai.configure(api_key=GEMINI_API_KEY)
model_ai = genai.GenerativeModel("gemini-1.5-flash")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory chat storage
chats = {}

class MessageRequest(BaseModel):
    chat_id: str
    message: str


@app.post("/chat/new")
def new_chat():
    chat_id = str(uuid.uuid4())
    chats[chat_id] = {"messages": [], "title": "New Chat"}
    return {"chat_id": chat_id}


@app.get("/chat/history")
def get_history():
    return {"chats": [{"id": k, "title": v["title"]} for k, v in chats.items()]}


@app.get("/chat/{chat_id}")
def get_chat(chat_id: str):
    if chat_id not in chats:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chats[chat_id]


@app.post("/chat/{chat_id}/analyze")
async def analyze_image(chat_id: str, file: UploadFile = File(...)):
    if chat_id not in chats:
        raise HTTPException(status_code=404, detail="Chat not found")

    image_bytes = await file.read()
    result = predict_disease(image_bytes)

    prompt = f"""
You are a plant disease expert assistant.

A plant image was analyzed by an AI model with the following result:
- Plant: {result['plant']}
- Condition: {result['condition']}
- Confidence: {result['confidence']}%

Please provide:
1. A brief explanation of what this disease/condition is
2. Why it happens and what causes it
3. How to treat it
4. How to prevent it in the future

Keep your response friendly, clear and practical.
"""

    response = model_ai.generate_content(prompt)
    ai_response = response.text

    chats[chat_id]["messages"].append({
        "role": "user",
        "type": "image",
        "content": f"[Image uploaded: {file.filename}]",
        "prediction": result
    })

    chats[chat_id]["messages"].append({
        "role": "assistant",
        "content": ai_response
    })

    if len(chats[chat_id]["messages"]) == 2:
        chats[chat_id]["title"] = f"{result['plant']} - {result['condition']}"

    return {
        "prediction": result,
        "response": ai_response
    }


@app.post("/chat/{chat_id}/message")
def send_message(request: MessageRequest):
    chat_id = request.chat_id

    if chat_id not in chats:
        raise HTTPException(status_code=404, detail="Chat not found")

    history = []

    for msg in chats[chat_id]["messages"]:
        if msg["role"] == "user":
            history.append({"role": "user", "parts": [msg["content"]]})
        else:
            history.append({"role": "model", "parts": [msg["content"]]})

    chat = model_ai.start_chat(history=history)
    response = chat.send_message(request.message)

    ai_response = response.text

    chats[chat_id]["messages"].append({
        "role": "user",
        "content": request.message
    })

    chats[chat_id]["messages"].append({
        "role": "assistant",
        "content": ai_response
    })

    return {"response": ai_response}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
