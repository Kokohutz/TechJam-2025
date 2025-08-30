import numpy as np
import pandas as pd
import json
import torch
import re
from datasets import load_dataset
from tqdm import tqdm
import tenseal as ts
import pickle
from typing import List, Dict, Tuple, Optional
import logging
from dataclasses import dataclass
import hashlib
import google.generativeai as genai
import time
import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

load_dotenv()  # Load environment variables from .env file
API_KEY = os.getenv("GEMINI_API_KEY", "")
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

device = "cuda:0" if torch.cuda.is_available() else "cpu"

@dataclass
class HEConfig:
    """Configuration for homomorphic encryption parameters"""
    poly_modulus_degree: int = 8192
    coeff_mod_bit_sizes: List[int] = None
    scale: float = 2.0**40
    cache_galois_keys: bool = True
    cache_relin_keys: bool = True
    
    def __post_init__(self):
        if self.coeff_mod_bit_sizes is None:
            self.coeff_mod_bit_sizes = [60, 40, 40, 60]

@dataclass
class PIIEntity:
    """Structure for PII entities with encryption metadata"""
    start: int
    end: int
    label: str
    text: str
    confidence: float = 1.0
    sensitivity_level: int = 1  # 1=low, 2=medium, 3=high
    encrypted_value: Optional[bytes] = None
    encryption_id: Optional[str] = None

class GeminiPIIEncryptionSystem:
    """Complete PII detection using Gemini-2.5-flash and homomorphic encryption system"""
    
    def __init__(self, api_key: str, he_config: HEConfig = None):
        self.api_key = api_key
        self.he_config = he_config or HEConfig()
        self.he_context = None
        self.entity_mappings = {}
        self.sensitivity_rules = self._init_sensitivity_rules()
        
        # Initialize Gemini
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Enhanced prompt for comprehensive PII detection
        self.ner_prompt = '''
You are an advanced Named Entity Recognition system specializing in detecting Personally Identifiable Information (PII).

Analyze the given text and extract ALL entities from these categories:
- PERSON: Full names, first names, last names, nicknames
- EMAIL: Email addresses
- PHONE: Phone numbers in any format
- SSN: Social Security Numbers
- CREDITCARD: Credit card numbers
- ADDRESS: Street addresses, postal addresses
- LOCATION: Cities, states, countries, landmarks
- ORGANIZATION: Companies, institutions, government agencies
- DATE: Dates in any format
- TIME: Time expressions
- ID_NUMBER: Any identification numbers (IC, passport, license, etc.)
- FINANCIAL: Account numbers, routing numbers, financial institutions
- MEDICAL: Medical record numbers, patient IDs
- USERNAME: Usernames, handles, user IDs
- IP_ADDRESS: IP addresses
- URL: Website URLs
- MISC: Any other potentially sensitive information

For each entity found, return a JSON object with:
- "text": the exact text of the entity
- "label": the category (PERSON, EMAIL, etc.)
- "start": character start position in the text
- "end": character end position in the text
- "confidence": confidence score (0.0 to 1.0)

Return ONLY a valid JSON array of entities. If no entities found, return an empty array [].

Text to analyze: "'''
        
    def _init_sensitivity_rules(self) -> Dict[str, int]:
        """Define sensitivity levels for different PII types"""
        return {
            # High sensitivity - Level 3 (Advanced HE)
            'SSN': 3, 'CREDITCARD': 3, 'ID_NUMBER': 3,
            'FINANCIAL': 3, 'MEDICAL': 3,
            
            # Medium sensitivity - Level 2 (Standard HE)
            'EMAIL': 2, 'PHONE': 2, 'ADDRESS': 2, 'DATE': 2,
            'IP_ADDRESS': 2, 'URL': 2,
            
            # Low sensitivity - Level 1 (Basic masking/light HE)
            'PERSON': 1, 'LOCATION': 1, 'ORGANIZATION': 1,
            'USERNAME': 1, 'TIME': 1, 'MISC': 1
        }
    
    def setup_he_context(self) -> ts.Context:
        """Initialize CKKS homomorphic encryption context"""
        logger.info("Setting up CKKS context...")
        
        context = ts.context(
            ts.SCHEME_TYPE.CKKS,
            poly_modulus_degree=self.he_config.poly_modulus_degree,
            coeff_mod_bit_sizes=self.he_config.coeff_mod_bit_sizes
        )
        
        context.generate_galois_keys()
        context.generate_relin_keys()
        context.global_scale = self.he_config.scale
        
        self.he_context = context
        logger.info("CKKS context initialized successfully")
        return context
    
    def detect_pii_entities_with_gemini(self, text: str, max_retries: int = 3) -> List[PIIEntity]:
        """Detect PII entities using Gemini-2.5-flash"""
        
        for attempt in range(max_retries):
            try:
                # Generate content with Gemini
                response = self.model.generate_content(self.ner_prompt + text + '"')
                response_text = response.text.strip()
                
                # Extract JSON from response
                entities_data = self._extract_json_from_response(response_text)
                
                # Convert to PIIEntity objects
                entities = []
                for entity_dict in entities_data:
                    try:
                        # Get sensitivity level
                        label = entity_dict.get('label', 'MISC')
                        sensitivity = self.sensitivity_rules.get(label, 1)
                        
                        entity = PIIEntity(
                            start=int(entity_dict['start']),
                            end=int(entity_dict['end']),
                            label=label,
                            text=entity_dict['text'],
                            confidence=float(entity_dict.get('confidence', 1.0)),
                            sensitivity_level=sensitivity
                        )
                        
                        # Validate entity positions
                        span = text[entity.start:entity.end]
                        if span != entity.text:
                            # Try to find the entity text in the original string
                            match = re.search(re.escape(entity.text), text)
                            if match:
                                entity.start, entity.end = match.start(), match.end()
                                logger.info(f"Corrected entity offsets for: {entity.text}")
                                entities.append(entity)
                            else:
                                logger.warning(f"Invalid entity positions for: {entity.text}")
                        else:
                            entities.append(entity)
                            
                    except (KeyError, ValueError, TypeError) as e:
                        logger.warning(f"Error processing entity {entity_dict}: {e}")
                        continue
                
                return entities
                
            except Exception as e:
                logger.warning(f"Attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep(1)  # Brief delay before retry
                continue
        
        logger.error(f"Failed to detect entities after {max_retries} attempts")
        return []
    
    def _extract_json_from_response(self, response_text: str) -> List[Dict]:
        """Extract JSON from Gemini response text"""
        try:
            # Try to find JSON block first
            json_match = re.search(r"```json\s*(.*?)\s*```", response_text, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                # Try to find array directly
                array_match = re.search(r'\[.*?\]', response_text, re.DOTALL)
                if array_match:
                    json_str = array_match.group(0)
                else:
                    # Fallback: try parsing entire response
                    json_str = response_text
            
            # Parse JSON
            entities = json.loads(json_str)
            
            # Ensure it's a list
            if isinstance(entities, dict):
                entities = [entities]
            elif not isinstance(entities, list):
                entities = []
                
            return entities
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error: {e}")
            logger.error(f"Response text: {response_text[:500]}...")
            return []
    
    def _text_to_vector(self, text: str, max_length: int = 100) -> List[float]:
        """Convert text to numerical vector for encryption"""
        # Enhanced encoding: use UTF-8 byte values normalized to [0,1]
        try:
            # Convert to bytes and normalize
            text_bytes = text.encode('utf-8')[:max_length]
            vector = [byte / 255.0 for byte in text_bytes]
            
            # Pad to fixed length
            if len(vector) < max_length:
                vector.extend([0.0] * (max_length - len(vector)))
                
            return vector[:max_length]
            
        except Exception as e:
            logger.error(f"Text vectorization error: {e}")
            # Fallback to simple ASCII encoding
            vector = [ord(c) / 127.0 for c in text[:max_length]]
            if len(vector) < max_length:
                vector.extend([0.0] * (max_length - len(vector)))
            return vector[:max_length]
    
    def _generate_encryption_id(self, entity: PIIEntity) -> str:
        """Generate unique ID for encrypted entity"""
        content = f"{entity.text}_{entity.label}_{entity.start}_{entity.end}"
        return hashlib.sha256(content.encode()).hexdigest()[:16]
    
    def encrypt_pii_entity(self, entity: PIIEntity) -> PIIEntity:
        """Encrypt a single PII entity using CKKS"""
        if not self.he_context:
            self.setup_he_context()
        
        try:
            # Convert text to vector
            vector = self._text_to_vector(entity.text)
            
            # Encrypt using CKKS
            encrypted_vector = ts.ckks_vector(self.he_context, vector)
            
            # Serialize encrypted data
            encrypted_bytes = encrypted_vector.serialize()
            
            # Update entity with encrypted data
            entity.encrypted_value = encrypted_bytes
            entity.encryption_id = self._generate_encryption_id(entity)
            
            # Store mapping for decryption
            self.entity_mappings[entity.encryption_id] = {
                'original_text': entity.text,
                'label': entity.label,
                'vector_length': len(vector),
                'encoding': 'utf-8'
            }
            
            logger.debug(f"Encrypted entity: {entity.label} - {entity.text[:20]}...")
            return entity
            
        except Exception as e:
            logger.error(f"Encryption error for entity {entity.text}: {e}")
            # Return entity without encryption
            entity.encryption_id = self._generate_encryption_id(entity)
            return entity
    
    def encrypt_text_pii(self, text: str, min_sensitivity: int = 0) -> Dict:
        """Detect and encrypt PII in text based on sensitivity level"""
        # Detect PII entities using Gemini
        logger.info(f"Detecting PII in text ({len(text)} chars)...")
        entities = self.detect_pii_entities_with_gemini(text)
        
        # Filter by sensitivity level
        entities_to_encrypt = [e for e in entities if e.sensitivity_level >= min_sensitivity]
        
        logger.info(f"Found {len(entities)} total entities, {len(entities_to_encrypt)} to encrypt")
        
        # Encrypt sensitive entities
        encrypted_entities = []
        processed_text = text
        offset = 0
        
        # Sort entities by start position (reverse order for safe replacement)
        entities_to_encrypt.sort(key=lambda x: x.start, reverse=True)
        
        for entity in entities_to_encrypt:
            # Encrypt the entity
            encrypted_entity = self.encrypt_pii_entity(entity)
            encrypted_entities.append(encrypted_entity)
            
            # Replace in text with placeholder (working backwards to preserve positions)
            start_pos = entity.start
            end_pos = entity.end
            placeholder = f"[ENCRYPTED_{encrypted_entity.encryption_id}]"
            
            processed_text = (processed_text[:start_pos] + 
                            placeholder + 
                            processed_text[end_pos:])
        
        # Sort back to original order for return
        encrypted_entities.reverse()
        
        return {
            'original_text': text,
            'processed_text': processed_text,
            'encrypted_entities': encrypted_entities,
            'total_entities': len(entities),
            'encrypted_count': len(encrypted_entities),
            'all_entities': entities,
            'gemini_response_time': None  # Can be added for performance monitoring
        }
    
    def decrypt_pii_entity(self, entity: PIIEntity) -> str:
        """Decrypt a PII entity"""
        if not entity.encrypted_value or not entity.encryption_id:
            return entity.text
        
        try:
            # Deserialize encrypted vector
            encrypted_vector = ts.lazy_ckks_vector_from(entity.encrypted_value)
            encrypted_vector.link_context(self.he_context)
            
            # Decrypt
            decrypted_vector = encrypted_vector.decrypt()
            
            # Convert back to text
            entity_info = self.entity_mappings.get(entity.encryption_id, {})
            original_text = entity_info.get('original_text', '')
            encoding = entity_info.get('encoding', 'utf-8')
            
            # Convert numbers back to bytes then to text
            if encoding == 'utf-8':
                byte_values = []
                for val in decrypted_vector:
                    if val > 0:  # Skip padding zeros
                        byte_val = int(round(val * 255.0))
                        if 0 <= byte_val <= 255:
                            byte_values.append(byte_val)
                
                try:
                    decrypted_text = bytes(byte_values).decode('utf-8').rstrip('\x00')
                    return decrypted_text[:len(original_text)]  # Trim to original length
                except UnicodeDecodeError:
                    pass
            
            # Fallback to ASCII
            chars = []
            for val in decrypted_vector[:len(original_text)]:
                if val > 0:
                    char_code = int(round(val * 127.0))
                    if 32 <= char_code <= 126:  # Printable ASCII
                        chars.append(chr(char_code))
            
            return ''.join(chars)
            
        except Exception as e:
            logger.error(f"Decryption error: {e}")
            return f"[DECRYPTION_ERROR_{entity.encryption_id}]"
    
    def batch_detect_pii(self, texts: List[str], batch_size: int = 5) -> List[List[PIIEntity]]:
        """Batch process multiple texts for PII detection"""
        results = []
        
        logger.info(f"Processing {len(texts)} texts in batches of {batch_size}")
        
        for i in tqdm(range(0, len(texts), batch_size), desc="Processing batches"):
            batch = texts[i:i+batch_size]
            batch_results = []
            
            for text in batch:
                try:
                    entities = self.detect_pii_entities_with_gemini(text)
                    batch_results.append(entities)
                    time.sleep(0.1)  # Rate limiting for API
                except Exception as e:
                    logger.error(f"Error processing text: {e}")
                    batch_results.append([])
            
            results.extend(batch_results)
        
        return results
    
    def save_he_context(self, filepath: str):
        """Save HE context and mappings"""
        save_data = {
            'context': self.he_context.serialize() if self.he_context else None,
            'mappings': self.entity_mappings,
            'config': self.he_config,
            'api_key': None  # Don't save API key for security
        }
        
        with open(filepath, 'wb') as f:
            pickle.dump(save_data, f)
        
        logger.info(f"HE context saved to {filepath}")
    
    def load_he_context(self, filepath: str):
        """Load HE context and mappings"""
        with open(filepath, 'rb') as f:
            save_data = pickle.load(f)
        
        if save_data['context']:
            self.he_context = ts.context_from(save_data['context'])
        
        self.entity_mappings = save_data['mappings']
        self.he_config = save_data['config']
        
        logger.info(f"HE context loaded from {filepath}")

def demo_gemini_pii_encryption():
    """Demonstrate the Gemini-based PII encryption system"""
    print("🔐 Gemini PII Homomorphic Encryption Demo")
    print("=" * 50)    
    
    # Initialize system
    system = GeminiPIIEncryptionSystem(API_KEY)
    
    # Sample text with various PII types
    sample_text = """
    John Doe's personal details: Email is john.doe@gmail.com, phone (555) 123-4567.
    His Social Security Number is 123-45-6789 and credit card is 4532-1234-5678-9012.
    He lives at 123 Main Street, New York, NY 10001. Born on March 15, 1985.
    Works at Microsoft Corporation. His employee ID is EMP789123.
    IP address: 192.168.1.1, website: https://johndoe.com
    """.strip()
    
    print("Original text:")
    print(sample_text)
    print("\n" + "-" * 60)
    
    # Setup HE context
    system.setup_he_context()
    
    # Detect PII using Gemini
    print("🔍 Detecting PII with Gemini-2.5-flash...")
    entities = system.detect_pii_entities_with_gemini(sample_text)
    
    if entities:
        print(f"\n✅ Found {len(entities)} PII entities:")
        print(f"{'#':<3} {'Type':<12} {'Text':<25} {'Confidence':<10} {'Sensitivity':<11}")
        print("-" * 70)
        
        for i, entity in enumerate(entities, 1):
            conf_str = f"{entity.confidence:.2f}"
            sens_str = f"Level {entity.sensitivity_level}"
            print(f"{i:<3} {entity.label:<12} {entity.text:<25} {conf_str:<10} {sens_str:<11}")
    else:
        print("❌ No PII entities detected")
        return
    
    # Encrypt PII (sensitivity level 2 and above)
    print(f"\n🔒 Encrypting PII (Level 2+)...")
    result = system.encrypt_text_pii(sample_text, min_sensitivity=2)
    
    print(f"\n📝 Processed text with encrypted PII:")
    print("=" * 60)
    print(result['processed_text'])
    print("=" * 60)
    
    print(f"\n📊 Encryption Summary:")
    print(f"   Total entities detected: {result['total_entities']}")
    print(f"   Entities encrypted: {result['encrypted_count']}")
    print(f"   Encryption ratio: {result['encrypted_count']/result['total_entities']*100:.1f}%")
    
    # Show encrypted entities details
    if result['encrypted_entities']:
        print(f"\n🔐 Encrypted Entities:")
        print("-" * 70)
        for entity in result['encrypted_entities']:
            size_kb = len(entity.encrypted_value) / 1024 if entity.encrypted_value else 0
            print(f"   {entity.label:<12} | '{entity.text:<20}' -> {entity.encryption_id}")
            print(f"   {'':14} | Sensitivity: {entity.sensitivity_level} | Size: {size_kb:.2f} KB")
    
    # Demo decryption
    print(f"\n🔓 Decryption Demo:")
    print("-" * 50)
    success_count = 0
    
    for i, entity in enumerate(result['encrypted_entities'][:3], 1):  # Show first 3
        if entity.encrypted_value:
            decrypted = system.decrypt_pii_entity(entity)
            is_match = entity.text == decrypted
            if is_match:
                success_count += 1
            
            print(f"{i}. ID: {entity.encryption_id}")
            print(f"   Original:  '{entity.text}'")
            print(f"   Decrypted: '{decrypted}'")
            print(f"   Status: {'✅ Match' if is_match else '❌ Mismatch'}")
            print()
    
    if result['encrypted_entities']:
        success_rate = success_count / min(3, len(result['encrypted_entities'])) * 100
        print(f"🎯 Decryption success rate: {success_rate:.1f}%")
    
    print("\n🎉 Demo completed!")

def advanced_gemini_demo():
    """Advanced demo with multiple texts and analysis"""
    print("\n" + "=" * 60)
    print("🚀 Advanced Gemini PII System Demo")
    print("=" * 60)
    
    system = GeminiPIIEncryptionSystem(API_KEY)
    system.setup_he_context()
    
    # Multiple test texts
    test_texts = [
        "Dr. Sarah Johnson can be reached at sjohnson@hospital.com or (555) 987-6543.",
        "Patient ID: PT123456, SSN: 987-65-4321, scheduled for surgery on 2024-04-15.",
        "Invoice for Alice Brown, credit card ****-****-****-1234, amount $1,299.99.",
        "Meeting with CEO at Google headquarters, 1600 Amphitheatre Pkwy, Mountain View.",
        "User login: alice_brown, IP: 10.0.0.1, session started at 14:30 PST."
    ]
    
    print(f"📦 Processing {len(test_texts)} sample texts...")
    
    # Process all texts
    all_results = []
    total_entities = 0
    total_encrypted = 0
    
    for i, text in enumerate(test_texts, 1):
        print(f"\n--- Text {i} ---")
        print(f"Input: {text}")
        
        result = system.encrypt_text_pii(text, min_sensitivity=2)
        all_results.append(result)
        
        total_entities += result['total_entities']
        total_encrypted += result['encrypted_count']
        
        print(f"Output: {result['processed_text']}")
        print(f"Entities: {result['total_entities']} total, {result['encrypted_count']} encrypted")
    
    # Overall statistics
    print(f"\n📈 Overall Statistics:")
    print(f"   Texts processed: {len(test_texts)}")
    print(f"   Total entities: {total_entities}")
    print(f"   Total encrypted: {total_encrypted}")
    print(f"   Overall encryption rate: {total_encrypted/total_entities*100:.1f}%")
    
    # Entity type distribution
    entity_types = {}
    for result in all_results:
        for entity in result['all_entities']:
            entity_types[entity.label] = entity_types.get(entity.label, 0) + 1
    
    print(f"\n📊 Entity Type Distribution:")
    for entity_type, count in sorted(entity_types.items()):
        print(f"   {entity_type:<12}: {count:2d} entities")
    
    return system, all_results


@app.get("/validate_text_msg")
def validate_text_msg(text: str):
    text = text.strip()
    
    entities = system.detect_pii_entities_with_gemini(text)
    
    # Encryption
    result = system.encrypt_text_pii(text, min_sensitivity=2)
    encrypted_text = result['processed_text']
    original_text = result['original_text']

    return {"entities": entities, "encrypted_text": encrypted_text, "original_text": original_text}

if __name__ == "__main__":
    system = GeminiPIIEncryptionSystem(API_KEY)
    system.setup_he_context()
    uvicorn.run(app, host="0.0.0.0", port=8003)
    

    # Run basic demo
    # demo_gemini_pii_encryption()
    
    # Uncomment for advanced demo
    # advanced_gemini_demo()