import numpy as np
import pandas as pd
import json
import torch
import spacy
from spacy.tokens import DocBin
from datasets import load_dataset
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from tqdm import tqdm
import tenseal as ts
import pickle
from typing import List, Dict, Tuple, Optional
import logging
from dataclasses import dataclass
import hashlib
import base64
import ast

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

class PIIEncryptionSystem:
    """Complete PII detection and homomorphic encryption system"""
    
    def __init__(self, he_config: HEConfig = None):
        self.he_config = he_config or HEConfig()
        self.nlp = None
        self.tokenizer = None
        self.he_context = None
        self.entity_mappings = {}
        self.sensitivity_rules = self._init_sensitivity_rules()
        
    def _init_sensitivity_rules(self) -> Dict[str, int]:
        """Define sensitivity levels for different PII types"""
        return {
            # High sensitivity - Level 3 (Advanced HE)
            'SSN': 3, 'CREDITCARDNUMBER': 3, 'ACCOUNTNUMBER': 3,
            'PASSWORD': 3, 'PIN': 3, 'BIOMETRIC': 3,
            
            # Medium sensitivity - Level 2 (Standard HE)
            'EMAIL': 2, 'PHONE': 2, 'ADDRESS': 2, 'DOB': 2,
            'MEDICALRECORD': 2, 'FINANCIALINFO': 2,
            
            # Low sensitivity - Level 1 (Basic masking/light HE)
            'FIRSTNAME': 1, 'LASTNAME': 1, 'CITY': 1, 'USERNAME': 1,
            'COMPANY': 1, 'JOBTITLE': 1
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
    
    def load_and_prepare_dataset(self, dataset_name: str = "Isotonic/pii-masking-200k"):
        """Load and prepare the PII dataset"""
        logger.info(f"Loading dataset: {dataset_name}")
        dataset = load_dataset(dataset_name, split="train")
        df = pd.DataFrame(dataset)
        
        train_data = []
        for i, row in tqdm(df.iterrows(), total=len(df), desc="Processing dataset"):
            text = row["unmasked_text"]
            entities = []
            
            try:
                masks = row["privacy_mask"]
                if isinstance(masks, str):
                    masks = row["privacy_mask"]
                if isinstance(masks, str):
                    try:
                        masks = json.loads(masks)  # try JSON first
                    except json.JSONDecodeError:
                        masks = ast.literal_eval(masks)  
                
                for key, mask in masks.items():
                    start_pos = text.find(mask)
                    if start_pos != -1:
                        end_pos = start_pos + len(mask)
                        label = key.strip('[]').split('_')[0]  # e.g., '[JOBTYPE_1]' -> 'JOBTYPE'
                        entities.append((start_pos, end_pos, label))
            

            except Exception as e:
                logger.warning(f"Error processing row {i}: {e}")
                continue
            
            if entities:
                train_data.append((text, {"entities": entities}))
        
        logger.info(f"Prepared {len(train_data)} training examples")
        return train_data

    
    def train_ner_model(self, train_data: List[Tuple], output_path: str = "./pii_train.spacy"):
        """Train spaCy NER model for PII detection"""
        logger.info("Creating spaCy training data...")
        
        nlp = spacy.blank("en")
        db = DocBin()
        
        successful_docs = 0
        for text, annot in tqdm(train_data, desc="Creating spaCy docs"):
            # try:
                doc = nlp.make_doc(text)
                ents = []
                
                spans = []
                for start, end, label in annot["entities"]:
                    span = doc.char_span(start, end, label=label, alignment_mode="contract")
                    if span:
                        spans.append(span)

                # Sort spans by start index
                spans = sorted(spans, key=lambda s: s.start)

                # Filter overlapping spans
                filtered_spans = []
                last_end = -1
                for span in spans:
                    if span.start >= last_end:
                        filtered_spans.append(span)
                        last_end = span.end  # update end of last accepted span

                if filtered_spans:
                    doc.ents = filtered_spans
                    db.add(doc)
                    successful_docs += 1

                    
            # except Exception as e:
            #     logger.warning(f"Error creating doc: {e}")
            #     continue
        
        db.to_disk(output_path)
        logger.info(f"Saved {successful_docs} training documents to {output_path}")
        return output_path
    
    def load_trained_model(self, model_path: str):
        """Load trained spaCy NER model"""
        try:
            self.nlp = spacy.load(model_path)
            logger.info(f"Loaded NER model from {model_path}")
        except:
            logger.warning("Trained model not found, using base English model")
            self.nlp = spacy.load("en_core_web_lg")
    
    def detect_pii_entities(self, text: str, confidence_threshold: float = 0.5) -> List[PIIEntity]:
        """Detect PII entities in text"""
        if not self.nlp:
            raise ValueError("NER model not loaded")
        
        doc = self.nlp(text)
        entities = []
        
        for ent in doc.ents:
            # Calculate sensitivity level
            sensitivity = self.sensitivity_rules.get(ent.label_, 1)
            
            pii_entity = PIIEntity(
                start=ent.start_char,
                end=ent.end_char,
                label=ent.label_,
                text=ent.text,
                confidence=1.0,  # spaCy doesn't provide confidence by default
                sensitivity_level=sensitivity
            )
            entities.append(pii_entity)
        
        return entities
    
    def _text_to_vector(self, text: str, max_length: int = 100) -> List[float]:
        """Convert text to numerical vector for encryption"""
        # Simple approach: use character codes normalized to [0,1]
        vector = [ord(c) / 127.0 for c in text[:max_length]]
        
        # Pad or truncate to fixed length
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
            'vector_length': len(vector)
        }
        
        return entity
    
    def encrypt_text_pii(self, text: str, min_sensitivity: int = 2) -> Dict:
        """Detect and encrypt PII in text based on sensitivity level"""
        # Detect PII entities
        entities = self.detect_pii_entities(text)
        
        print(f"Detected {len(entities)} PII entities")
        print(f"Entities: {[e for e in entities]}")

        # Filter by sensitivity level
        entities_to_encrypt = [e for e in entities if e.sensitivity_level >= min_sensitivity]
        
        # Encrypt sensitive entities
        encrypted_entities = []
        processed_text = text
        offset = 0
        
        # Sort entities by start position
        entities_to_encrypt.sort(key=lambda x: x.start)
        
        for entity in entities_to_encrypt:
            # Encrypt the entity
            encrypted_entity = self.encrypt_pii_entity(entity)
        

            encrypted_entities.append(encrypted_entity)
            
            # Replace in text with placeholder
            start_pos = entity.start + offset
            end_pos = entity.end + offset
            placeholder = f"[ENCRYPTED_{encrypted_entity.encryption_id}]"
            
            processed_text = (processed_text[:start_pos] + 
                            placeholder + 
                            processed_text[end_pos:])
            
            # Update offset for next replacements
            offset += len(placeholder) - (entity.end - entity.start)
        
        return {
            'original_text': text,
            'processed_text': processed_text,
            'encrypted_entities': encrypted_entities,
            'total_entities': len(entities),
            'encrypted_count': len(encrypted_entities)
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
            
            # Convert back to text (simplified - in practice you'd want better encoding)
            entity_info = self.entity_mappings.get(entity.encryption_id, {})
            original_length = len(entity_info.get('original_text', ''))
            
            # Convert numbers back to characters
            chars = []
            for val in decrypted_vector[:original_length]:
                char_code = int(val * 127.0)
                if 32 <= char_code <= 126:  # Printable ASCII
                    chars.append(chr(char_code))
            
            return ''.join(chars)
            
        except Exception as e:
            logger.error(f"Decryption error: {e}")
            return f"[DECRYPTION_ERROR_{entity.encryption_id}]"
    
    def save_he_context(self, filepath: str):
        """Save HE context and mappings"""
        save_data = {
            'context': self.he_context.serialize() if self.he_context else None,
            'mappings': self.entity_mappings,
            'config': self.he_config
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

def demo_pii_encryption():
    """Demonstrate the PII encryption system"""
    print("🔐 PII Homomorphic Encryption Demo")
    print("=" * 50)
    
    # Initialize system
    system = PIIEncryptionSystem()
    
    # Sample text with PII
    sample_text = """
    Hi John Doe, your credit card 4532-1234-5678-9012 has been charged $500.
    Please contact us at john.doe@email.com or call (555) 123-4567 if you have questions.
    Your account number is ACC123456789 and SSN is 123-45-6789.
    """
    
    print("Original text:")
    print(sample_text)
    print("\n" + "-" * 50)
    
    # Setup HE context
    system.setup_he_context()
    
    # For demo, we'll use a simple spaCy model
    system.load_trained_model("en_core_web_lg")  # Base model for demo
    
    # Encrypt PII (sensitivity level 2 and above)
    result = system.encrypt_text_pii(sample_text, min_sensitivity=0)
    
    print("\nProcessed text with encrypted PII:")
    print(result['processed_text'])
    
    print(f"\nEncryption Summary:")
    print(f"Total entities found: {result['total_entities']}")
    print(f"Entities encrypted: {result['encrypted_count']}")
    
    print("\nEncrypted entities:")
    for entity in result['encrypted_entities']:
        print(f"- {entity.label}: '{entity.text}' -> {entity.encryption_id}")
        print(f"  Sensitivity level: {entity.sensitivity_level}")
        print(f"  Encrypted size: {len(entity.encrypted_value)} bytes")
    
    # Demo decryption
    print("\n" + "-" * 50)
    print("Decryption demo:")

    for entity in result['encrypted_entities'][:2]:  # Show first 2
        decrypted = system.decrypt_pii_entity(entity)
        print(f"Decrypted {entity.encryption_id}: '{decrypted}'")

if __name__ == "__main__":
    # Uncomment to run full training pipeline
    system = PIIEncryptionSystem()
    train_data = system.load_and_prepare_dataset()
    system.train_ner_model(train_data)
    
    # Run demo
    demo_pii_encryption()