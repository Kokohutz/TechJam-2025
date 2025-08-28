🚀 Running Privacy-Preserving YOLO Demo
This demo shows how to integrate homomorphic encryption with YOLO models

🔐 Privacy-Preserving YOLO Demo (Standalone)
============================================================
1. Initializing Privacy-Preserving YOLO System...

2. Testing different privacy levels...

--- Privacy Level 1 ---
Privacy Level: 1
Detected objects: 3
Average confidence: 0.763

--- Privacy Level 2 ---
Privacy Level: 2
PSNR: 10.78 dB
SSIM: 0.023
Detected objects: 2
Average confidence: 0.945

--- Privacy Level 3 ---
Privacy Level: 3
Detected objects: 3
Average confidence: 0.458

3. Privacy Analysis...
Privacy Score: 1.084
MI Estimate: 2.003
Attack Resistance: 0.166

4. Encryption Performance Metrics...
Encryption time: 0.626 seconds
Encrypted tiles: 64
Grid shape: (8, 8)
Reconstruction time: 0.175 seconds
Reconstructed shape: (640, 640, 3)

🎯 YOLO Privacy Demo Completed!

============================================================
WHEN YOU HAVE A DATASET - PRACTICAL EXAMPLES:
============================================================

📁 Dataset Preparation:

# 1. Organize your dataset in YOLO format:
dataset/
  ├── images/
  │   ├── train/
  │   ├── val/
  │   └── test/
  └── labels/
      ├── train/
      ├── val/ 
      └── test/

# 2. Each label file should contain:
# class_id x_center y_center width height [polygon_points...]
# Example: 0 0.5 0.3 0.2 0.4  # person at center-left


🔧 Real Implementation Example:

# Install required packages:
# pip install ultralytics tenseal cryptography opencv-python

from ultralytics import YOLO
import cv2

# 1. Load your YOLO model
model_path = "yolov8n-seg.pt"  # or your custom trained model
encryption_system = YOLOImageEncryptionSystem()

# 2. Initialize privacy-preserving YOLO
privacy_yolo = PrivacyPreservingYOLO(model_path, encryption_system, demo_mode=False)

# 3. Process your images
image_path = "path/to/your/image.jpg"
image = cv2.imread(image_path)
image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

# 4. Run encrypted inference
result = privacy_yolo.encrypt_and_predict(
    image, 
    confidence=0.25,
    privacy_level=2  # Choose based on your privacy needs
)

# 5. Access results
if not privacy_yolo.demo_mode:
    yolo_results = result['results'][0]
    
    # Bounding boxes
    boxes = yolo_results.boxes.xyxy.cpu().numpy()  # x1,y1,x2,y2 format
    confidences = yolo_results.boxes.conf.cpu().numpy()
    class_ids = yolo_results.boxes.cls.cpu().numpy()
    
    # Segmentation masks (if using seg model)
    if hasattr(yolo_results, 'masks') and yolo_results.masks is not None:
        masks = yolo_results.masks.data.cpu().numpy()
    
    print(f"Found {len(boxes)} objects")
    for i, (box, conf, cls) in enumerate(zip(boxes, confidences, class_ids)):
        print(f"Object {i}: Class {int(cls)}, Confidence {conf:.3f}, Box {box}")


🏭 Training Your Own Privacy-Preserving Model:

# 1. Setup federated training
fed_trainer = FederatedYOLOTrainer("path/to/your/yolo_config.yaml", num_clients=5, demo_mode=False)

# 2. Prepare client data splits
client_data_splits = [
    {
        'images': ['client1_images/*.jpg'],
        'annotations': ['client1_labels/*.txt']
    },
    # ... more clients
]

fed_trainer.setup_client_data(client_data_splits)

# 3. Run federated training rounds
for round_num in range(100):
    results = fed_trainer.train_federated_round(round_num, local_epochs=5)
    print(f"Round {round_num}: Privacy budget used: {results.get('privacy_budget_used', 0.1)}")
    
    # Monitor privacy budget
    if fed_trainer.privacy_budget <= 0.1:
        print("Privacy budget exhausted, stopping training")
        break


🔒 Privacy Configuration Guide:

# Choose privacy level based on your use case:

# Medical/Healthcare Images (Maximum Privacy)
config = {
    'privacy_level': 3,           # Full homomorphic encryption
    'differential_privacy': True,
    'privacy_budget': 0.5,       # Strict budget
    'federated_learning': True,
    'secure_aggregation': True
}

# Surveillance/Security (Balanced)
config = {
    'privacy_level': 2,           # Hybrid encryption
    'differential_privacy': True,
    'privacy_budget': 1.0,
    'federated_learning': True,
    'secure_aggregation': False
}

# Research/Development (Performance Priority)
config = {
    'privacy_level': 1,           # Format-preserving
    'differential_privacy': False,
    'privacy_budget': 2.0,
    'federated_learning': False,
    'secure_aggregation': False
}


⚡ Performance Benchmarks (Expected):
Privacy Level 1: ~5% overhead, 95% accuracy retention
Privacy Level 2: ~50% overhead, 85% accuracy retention
Privacy Level 3: ~10x overhead, 70% accuracy retention

✅ Next Steps:
1. Install ultralytics: pip install ultralytics
2. Prepare your dataset in YOLO format
3. Choose appropriate privacy level for your use case
4. Run training with privacy_yolo.encrypt_and_predict()
5. Monitor privacy budget and model performance