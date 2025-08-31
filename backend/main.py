from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
import uvicorn
import uuid
import time
import requests
import re
import base64
import io
from PIL import Image

# Import your OCR pipeline function
from ocr_pipeline import run_ocr_pipeline  # Assuming the previous code is in ocr_pipeline.py

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models ---
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

class ImageUrlModel(BaseModel):
    imageUrl: str


# --- In-memory Storage ---
users: Dict[str, dict] = {}
chats: Dict[str, dict] = {}
messages: Dict[str, List[dict]] = {}

# --- Helper Functions ---
def download_and_encode_image(image_url: str) -> str:
    """Download image from URL and return base64 encoded data"""
    try:
        response = requests.get(image_url, timeout=10)
        response.raise_for_status()
        return base64.b64encode(response.content).decode('utf-8')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to download image: {str(e)}")

def validate_text_with_service(text: str, validation_endpoint: str = "127.0.0.1:8003") -> Dict:
    """Validate text using the validation service"""
    try:
        headers = {"Content-Type": "application/json"}
        response = requests.get(f"http://{validation_endpoint}/validate_text_msg?text={text}", headers=headers)
        
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Validation service failed with status code: {response.status_code}")
            return {
                'original_text': text,
                'encrypted_text': text,
                'entities': []
            }
    except requests.exceptions.RequestException as e:
        print(f"Error connecting to validation service: {e}")
        return {
            'original_text': text,
            'encrypted_text': text,
            'entities': []
        }

def process_ocr_results_with_validation(ocr_results: List[Dict], image_dims: tuple) -> Dict:
    """
    Process OCR results by combining text for validation and mapping results back.
    MODIFIED: Now accepts image_dims to calculate relative bboxes.
    """
    img_width, img_height = image_dims
    if not ocr_results:
        return {
            'processed_results': [],
            'all_sensitive_words': [],
            'total_detections': 0,
            'sensitive_detections': 0
        }

    combined_text = ' '.join([text.get('text', '').strip() for text in ocr_results])

    # combined_text = ""
    # index_map = []
    # current_pos = 0
    # for i, result in enumerate(ocr_results):
    #     text = result.get('text', '').strip()
    #     if not text or len(text) < 2: continue

    #     combined_text += text; current_pos += len(text)

    validation_result = validate_text_with_service(combined_text)

    any_sensitive = any(([result.get("sensitivity_level", 0) > 1 for result in validation_result.get('entities', [])]))
    if not any_sensitive:

        return {
            'is_sensitive': False
        }

    return {
        'is_sensitive': True,
    }
    

    
    # return {
    #     'processed_results': ocr_results,
    #     'all_sensitive_words': [entity["text"] for entity in validation_result.get('entities', []) if entity.get("sensitivity_level", 0) >= 1],
    #     'total_detections': len(ocr_results),
    #     'sensitive_detections': sum(1 for entity in validation_result.get('entities', []) if entity.get("sensitivity_level", 0) >= 1)
    # }

    # processed_results = []
    # for result in ocr_results:
    #     x_min, y_min, x_max, y_max = result['bbox']
    #     relative_bbox = [x_min / img_width, y_min / img_height, x_max / img_width, y_max / img_height]
    #     processed_results.append({
    #         'bbox': result['bbox'], 'relative_bbox': relative_bbox, 'text': result.get('text', '').strip(),
    #         'score': result.get('score'), 'type': result.get('type'), 'original_text': result.get('text', '').strip(),
    #         'encrypted_text': result.get('text', '').strip(), 'is_sensitive': False,
    #         'sensitive_entities': [], 'encrypted_words': []
    #     })

    # all_sensitive_words = []
    # entities = validation_result.get('entities', [])
    # for entity in entities:
    #     if entity.get("sensitivity_level", 0) >= 1:
    #         entity_text = entity["text"]
    #         entity_start, entity_end = entity.get("start", -1), entity.get("end", -1)
    #         if entity_start != -1:
    #             for mapping in index_map:
    #                 if entity_start >= mapping['start'] and entity_end <= mapping['end']:
    #                     original_index = mapping['original_index']
    #                     processed_results[original_index]['is_sensitive'] = True
    #                     processed_results[original_index]['sensitive_entities'].append(entity)
    #                     processed_results[original_index]['encrypted_words'].append(entity_text)
    #                     all_sensitive_words.append(entity_text)
    #                     break
    
    
    
    # sensitive_detections = sum(1 for r in processed_results if r['is_sensitive'])
    # final_processed_results = [p for p in processed_results if p['text'] and len(p['text']) >= 2]

    # print(final_processed_results)

    # return {
    #     'processed_results': final_processed_results,
    #     'all_sensitive_words': list(set(all_sensitive_words)),
    #     'total_detections': len(final_processed_results),
    #     'sensitive_detections': sensitive_detections
    # }

# --- API Endpoints ---

@app.get('/health')
def health_check():
    return {'status': 'healthy', 'timestamp': time.time() * 1000}

# User Management Endpoints
@app.post('/users/register', status_code=201)
def register_user(user_data: UserRegister):
    username = user_data.username.strip()
    if not username or len(username) < 3: raise HTTPException(status_code=400, detail='Username must be at least 3 characters')
    if username in users: raise HTTPException(status_code=409, detail='Username already exists')
    user = {'username': username, 'avatar': user_data.avatar, 'created_at': time.time() * 1000}; users[username] = user
    return {'user': user}

@app.get('/users/profile/{username}')
def get_user_profile(username: str):
    if username not in users: raise HTTPException(status_code=404, detail='User not found')
    return {'user': users[username]}

@app.get('/users/search')
def search_users(q: str = "", current_user: str = ""):
    query = q.lower()
    if not query: filtered_users = [user for uname, user in users.items() if uname != current_user]
    else: filtered_users = [user for uname, user in users.items() if query in uname.lower() and uname != current_user]
    return {'users': filtered_users}

# Chat Management Endpoints
@app.get('/chats/{username}')
def get_user_chats(username: str):
    if username not in users: raise HTTPException(status_code=404, detail='User not found')
    user_chats = []
    for chat_id, chat in chats.items():
        if username in chat['participants']:
            other_user = next(p for p in chat['participants'] if p != username)
            chat_msgs = messages.get(chat_id, []); last_msg = chat_msgs[-1] if chat_msgs else None
            user_chats.append({
                'id': chat_id, 'username': other_user, 'avatar': users.get(other_user, {}).get('avatar'),
                'lastMessage': last_msg['content'] if last_msg else None, 'messages': chat_msgs,
                'unreadCount': 0, 'timestamp': last_msg['timestamp'] if last_msg else chat['created_at']
            })
    user_chats.sort(key=lambda x: x['timestamp'], reverse=True)
    return {'chats': user_chats}

@app.post('/chats/create', status_code=201)
def create_chat(chat_data: ChatCreate):
    user1, user2 = chat_data.user1, chat_data.user2
    if not user1 or not user2: raise HTTPException(status_code=400, detail='Both users required')
    if user1 not in users or user2 not in users: raise HTTPException(status_code=404, detail='One or both users not found')
    for chat_id, chat in chats.items():
        if set(chat['participants']) == {user1, user2}: return {'chat_id': chat_id}
    chat_id = str(uuid.uuid4()); chat = {'id': chat_id, 'participants': [user1, user2], 'created_at': time.time() * 1000}
    chats[chat_id] = chat; messages[chat_id] = []
    return {'chat_id': chat_id}

# Message Endpoints
@app.get('/chats/{chat_id}/messages')
def get_messages(chat_id: str):
    if chat_id not in chats: raise HTTPException(status_code=404, detail='Chat not found')
    return {'messages': messages.get(chat_id, [])}


@app.post('/chats/{chat_id}/messages', status_code=201)
def send_message(chat_id: str, msg_data: MessageCreate):
    if chat_id not in chats:
        raise HTTPException(status_code=404, detail='Chat not found')

    content = msg_data.content.strip() if msg_data.content else ""
    sender = msg_data.sender
    image_url = msg_data.imageUrl

    if image_url:
        message = {
            'id': str(uuid.uuid4()),
            'type': 'user',
            'username': sender,
            'timestamp': time.time() * 1000,
            'imageUrl': image_url,
        }
        messages.setdefault(chat_id, []).append(message)
        return {'message': message}

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
        'encrypted_words': encrypted_words_list,  # in case we want to decrypt, the list is in the order of appearance (1st ENCRYPTED_** = index[0])
        'original_text': json_response['original_text'],  # in case uw just show everything
        'encrypted_text': json_response['encrypted_text'] # in case uw want to show everything encrypted
    }
    messages.setdefault(chat_id, []).append(message)

    print(messages)
    return {'message': message}

# @app.post('/chats/{chat_id}/messages', status_code=201)
# def send_message(chat_id: str, msg_data: MessageCreate):
#     if chat_id not in chats: raise HTTPException(status_code=404, detail='Chat not found')
#     content = msg_data.content.strip() if msg_data.content else ""; sender = msg_data.sender; image_url = msg_data.imageUrl
#     if not sender: raise HTTPException(status_code=400, detail='Sender required')
#     if not content and not image_url: raise HTTPException(status_code=400, detail='Message content or image required')
#     if sender not in users: raise HTTPException(status_code=404, detail='Sender not found')
#     if sender not in chats[chat_id]['participants']: raise HTTPException(status_code=403, detail='User not in chat')

#     encrypted_words_list = []; final_content = content; original_text = content; encrypted_text = content; ocr_analysis = None
#     if image_url:
#         try:
#             image_base64 = download_and_encode_image(image_url)
#             ocr_result = run_ocr_pipeline(image_base64)
#             if ocr_result['success']:
#                 # Note: We don't have image dimensions here, so relative bboxes can't be calculated
#                 # in this flow. The analysis happens *before* sending.
#                 ocr_analysis = process_ocr_results_with_validation(ocr_result['results'], (1,1)) # Dummy dims
#                 encrypted_words_list.extend(ocr_analysis['all_sensitive_words'])
#             else: ocr_analysis = {'error': ocr_result.get('error', 'OCR processing failed')}
#         except Exception as e: ocr_analysis = {'error': f"Image processing failed: {str(e)}"}
#     if content:
#         try:
#             response = requests.get(f"http://127.0.0.1:8003/validate_text_msg?text={content}", headers={"Content-Type": "application/json"})
#             if response.status_code == 200:
#                 json_resp = response.json(); entity_list = json_resp.get('entities', [])
#                 for item in entity_list:
#                     if item.get("sensitivity_level", 0) >= 2: encrypted_words_list.append(item["text"])
#                 final_content = json_resp.get('encrypted_text', content)
#                 original_text = json_resp.get('original_text', content)
#                 encrypted_text = json_resp.get('encrypted_text', content)
#         except requests.exceptions.RequestException as e: print(f"Error connecting to validation service: {e}")

#     message = {
#         'id': str(uuid.uuid4()), 'content': final_content, 'type': 'user', 'timestamp': time.time() * 1000,
#         'username': sender, 'imageUrl': image_url, 'encrypted_words': encrypted_words_list,
#         'original_text': original_text, 'encrypted_text': encrypted_text, 'ocr_analysis': ocr_analysis
#     }
#     messages.setdefault(chat_id, []).append(message)
#     return {'message': message}

# ENCRYPTED_RE = re.compile(r"\[ENCRYPTED_[^\]]+\]")
@app.post('/chats/{chat_id}/messages/decrypt/{msg_id}')
# def decrypt_messages(chat_id: str, msg_id: str, enc_msg: str):
def decrypt_messages(chat_id: str, msg_id: str):
    if chat_id not in chats:
        raise HTTPException(status_code=404, detail='Chat not found')
    chat_messages = messages.get(chat_id, [])
    message = next((msg for msg in chat_messages if msg['id'] == msg_id), None)
    if not message:
        raise HTTPException(status_code=404, detail='Message not found')
    
    # content = message['content']
    # encrypted_words = message['encrypted_words']
    # encrypted_text = message['encrypted_text']

    # index_positions = [m.group(0) for m in ENCRYPTED_RE.finditer(encrypted_text)]
    # idx = index_positions.index(enc_msg)
    
    # original_word = encrypted_words[idx] if idx < len(encrypted_words) else None
    
    # content = content.replace(enc_msg, original_word)
    
    # message['content'] = content
    message['content'] = message['original_text']
    
    return {'message': message}

@app.get('/chats/{chat_id}/messages/since/{timestamp}')
def get_messages_since(chat_id: str, timestamp: float):
    if chat_id not in chats: raise HTTPException(status_code=404, detail='Chat not found')
    new_messages = [msg for msg in messages.get(chat_id, []) if msg['timestamp'] > timestamp]
    return {'messages': new_messages}

@app.post('/ocr/analyze')
def analyze_image_ocr(payload: ImageUrlModel):
    """Standalone endpoint for OCR analysis that returns relative bboxes."""
    image_url = payload.imageUrl
    if not image_url:
        raise HTTPException(status_code=400, detail="imageUrl is required")
        
    try:
        response = requests.get(image_url, timeout=10)
        response.raise_for_status()
        image_content = response.content
        
        image = Image.open(io.BytesIO(image_content))
        image_dims = image.size # Get (width, height)
        
        image_base64 = base64.b64encode(image_content).decode('utf-8')
        
        ocr_result = run_ocr_pipeline(image_base64)
        
        if ocr_result['success']:
            analysis = process_ocr_results_with_validation(ocr_result['results'], image_dims)
            return {'success': True, 'analysis': analysis}
        else:
            raise HTTPException(status_code=500, detail=ocr_result.get('error', 'OCR processing failed'))
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Admin endpoints
@app.get('/admin/users')
def list_all_users(): return {'users': list(users.values())}
@app.get('/admin/chats')
def list_all_chats(): return {'chats': chats}
@app.get('/admin/messages')
def list_all_messages(): return {'messages': messages}

if __name__ == '__main__':
    uvicorn.run(app, host="0.0.0.0", port=8002)