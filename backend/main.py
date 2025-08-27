from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import asyncio
import uuid

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Message(BaseModel):
    text: str
    senderID: int
    recipientID: int

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, set[WebSocket]] = {}
        self.lock = asyncio.Lock()
        
    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        async with self.lock:
            self.active_connections.setdefault(user_id, set()).add(websocket)
            print("User Connected", self.active_connections)

    async def disconnect(self, websocket: WebSocket, user_id: int):
        async with self.lock:
            if user_id in self.active_connections:
                self.active_connections[user_id].discard(websocket)
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]

    async def push_to_user(self, user_id: int, message: dict):
        async with self.lock:
            if user_id in self.active_connections:
                for connection in self.active_connections[user_id]:
                    await connection.send_json(message)

connector = ConnectionManager()

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/test")
async def get_index():
    return FileResponse("test.html")
@app.get("/test2")
async def get_index2():
    return FileResponse("test2.html")
@app.get("/test3")
async def get_index3():
    return FileResponse("test3.html")


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    await connector.connect(websocket, user_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await connector.disconnect(websocket, user_id)


MESSAGES: dict[tuple, dict] = {} # tuple will be (sender_id, recipient_id), dict will be {message_id: message_dict}
def format_tuple(sender_id: int, recipient_id: int) -> tuple:
    return tuple(sorted((sender_id, recipient_id)))

@app.post("/send_message")
async def send_message(message: Message):
    msg = {
        "id": str(uuid.uuid4()),
        "text": message.text,
        "sender_id": message.senderID,
        "recipient_id": message.recipientID,
        "created_at": datetime.now().isoformat(),
        "status": "sent",
    }
    await connector.push_to_user(
        message.recipientID,
        {"type": "message", "message": msg}
    )
    MESSAGES.setdefault(format_tuple(message.senderID, message.recipientID), {})[msg["id"]] = msg
    return {"ok": True}

@app.get("/get_conversation/{other_user_id}/messages")
async def get_conversation(other_user_id: int, me: int = Query(...)):
    conversation = list(MESSAGES.get(format_tuple(me, other_user_id), {}).values())
    conversation.sort(key=lambda x: x["created_at"])
    print(conversation)
    return conversation