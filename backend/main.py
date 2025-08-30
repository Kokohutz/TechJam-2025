from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
import uvicorn
import uuid
import time
import requests

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# --- Pydantic Models for Request Bodies ---
# These replace request.get_json() and provide automatic validation

class UserRegister(BaseModel):
    username: str
    avatar: Optional[str] = None

class ChatCreate(BaseModel):
    user1: str
    user2: str

class MessageCreate(BaseModel):
    content: Optional[str] = ""
    sender: str
    imageUrl: Optional[str] = None


# --- In-memory Storage (same as the Flask app) ---
users: Dict[str, dict] = {}
chats: Dict[str, dict] = {}
messages: Dict[str, List[dict]] = {}

# --- Pre-populate with demo users (same as the Flask app) ---
def setup_demo_users():
    global users, chats, messages
    users, chats, messages = {}, {}, {} # Clear existing data
    demo_users = ['alice_dev', 'bob_designer', 'charlie_pm', 'diana_engineer', 'eve_artist', 'frank_writer']
    for username in demo_users:
        users[username] = {
            'username': username,
            'avatar': None,
            'created_at': time.time() * 1000
        }
    return demo_users

demo_users = setup_demo_users()


# --- API Endpoints (Direct Translation from Flask) ---

@app.get('/health')
def health_check():
    return {'status': 'healthy', 'timestamp': time.time() * 1000}

# User Management Endpoints
@app.post('/users/register', status_code=201)
def register_user(user_data: UserRegister):
    username = user_data.username.strip()

    if not username or len(username) < 3:
        raise HTTPException(status_code=400, detail='Username must be at least 3 characters')

    if username in users:
        raise HTTPException(status_code=409, detail='Username already exists')

    user = {
        'username': username,
        'avatar': user_data.avatar,
        'created_at': time.time() * 1000
    }
    users[username] = user
    return {'user': user}

@app.get('/users/profile/{username}')
def get_user_profile(username: str):
    if username not in users:
        raise HTTPException(status_code=404, detail='User not found')
    return {'user': users[username]}

@app.get('/users/search')
def search_users(q: str = "", current_user: str = ""):
    query = q.lower()
    if not query:
        # Return all users except current user if no query
        filtered_users = [user for username, user in users.items() if username != current_user]
    else:
        filtered_users = [
            user for username, user in users.items()
            if query in username.lower() and username != current_user
        ]
    return {'users': filtered_users}

# Chat Management Endpoints
@app.get('/chats/{username}')
def get_user_chats(username: str):
    if username not in users:
        raise HTTPException(status_code=404, detail='User not found')

    user_chats = []
    for chat_id, chat in chats.items():
        if username in chat['participants']:
            other_participant = next(p for p in chat['participants'] if p != username)
            chat_messages = messages.get(chat_id, [])
            last_message = chat_messages[-1] if chat_messages else None
            unread_count = 0  # Simplified

            user_chats.append({
                'id': chat_id,
                'username': other_participant,
                'avatar': users.get(other_participant, {}).get('avatar'),
                'lastMessage': last_message['content'] if last_message else None,
                'messages': chat_messages,
                'unreadCount': unread_count,
                'timestamp': last_message['timestamp'] if last_message else chat['created_at']
            })

    user_chats.sort(key=lambda x: x['timestamp'], reverse=True)
    return {'chats': user_chats}

@app.post('/chats/create', status_code=201)
def create_chat(chat_data: ChatCreate):
    user1, user2 = chat_data.user1, chat_data.user2
    if not user1 or not user2:
        raise HTTPException(status_code=400, detail='Both users required')
    if user1 not in users or user2 not in users:
        raise HTTPException(status_code=404, detail='One or both users not found')

    # Check if chat already exists
    for chat_id, chat in chats.items():
        if set(chat['participants']) == {user1, user2}:
            return {'chat_id': chat_id}

    # Create new chat
    chat_id = str(uuid.uuid4())
    chat = {
        'id': chat_id,
        'participants': [user1, user2],
        'created_at': time.time() * 1000
    }
    chats[chat_id] = chat
    messages[chat_id] = []
    return {'chat_id': chat_id}

# Message Endpoints
@app.get('/chats/{chat_id}/messages')
def get_messages(chat_id: str):
    if chat_id not in chats:
        raise HTTPException(status_code=404, detail='Chat not found')
    return {'messages': messages.get(chat_id, [])}

@app.post('/chats/{chat_id}/messages', status_code=201)
def send_message(chat_id: str, msg_data: MessageCreate):
    if chat_id not in chats:
        raise HTTPException(status_code=404, detail='Chat not found')

    content = msg_data.content.strip() if msg_data.content else ""
    sender = msg_data.sender
    image_url = msg_data.imageUrl

    if not sender:
        raise HTTPException(status_code=400, detail='Sender required')
    if not content and not image_url:
        raise HTTPException(status_code=400, detail='Message content or image required')
    if sender not in users:
        raise HTTPException(status_code=404, detail='Sender not found')
    if sender not in chats[chat_id]['participants']:
        raise HTTPException(status_code=403, detail='User not in chat')

    # Validate message content
    endpoint = "127.0.0.1:8003"
    headers = {"Content-Type": "application/json"}
    response = requests.get(f"http://{endpoint}/validate_text_msg?text={content}", headers=headers)

    if response.status_code != 200:
        raise HTTPException(status_code=400, detail='Invalid message content')

    json_response = response.json()
    # End

    entity_list = json_response.get('entities', [])
    encrypted_words_list = []
    for dict in entity_list:
        if dict["sensitivity_level"] >=2:
            encrypted_words_list.append(dict["text"])
    print("Encrypted_words", encrypted_words_list)

    message = {
        'id': str(uuid.uuid4()),
        'content': json_response['encrypted_text'], # Auto show the encrypted text
        'type': 'user',
        'timestamp': time.time() * 1000,
        'imageUrl': image_url,
        'username': sender,
        'encrypted_words': encrypted_words_list # in case uw to decrypt, the list is in the order of appearance (1st ENCRYPTED_** = index[0])
    }
    messages.setdefault(chat_id, []).append(message)
    return {'message': message}

# Real-time polling endpoint (THE FIX)
@app.get('/chats/{chat_id}/messages/since/{timestamp}')
def get_messages_since(chat_id: str, timestamp: float):
    if chat_id not in chats:
        raise HTTPException(status_code=404, detail='Chat not found')

    chat_messages = messages.get(chat_id, [])
    new_messages = [msg for msg in chat_messages if msg['timestamp'] > timestamp]

    return {'messages': new_messages}


# Admin endpoints for testing
@app.get('/admin/users')
def list_all_users():
    return {'users': list(users.values())}

@app.get('/admin/chats')
def list_all_chats():
    return {'chats': chats}

@app.get('/admin/messages')
def list_all_messages():
    return {'messages': messages}

@app.post('/admin/reset')
def reset_data():
    global demo_users
    demo_users = setup_demo_users()
    return {'message': 'Data reset successfully', 'demo_users': demo_users}


if __name__ == '__main__':
    uvicorn.run(app, host="0.0.0.0", port=8002)