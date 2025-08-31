import cv2
import numpy as np
import base64
import math
import requests
from scipy.ndimage import interpolation as inter
from typing import List, Dict, Tuple, Optional
from ultralytics import YOLO
from paddleocr import PaddleOCR

# Initialize models (do this once at startup)
imgsz = 640
model = YOLO('./best.pt')
ocr = PaddleOCR(
    ocr_version='PP-OCRv5',
    use_doc_orientation_classify=True, 
    use_doc_unwarping=False, 
    use_textline_orientation=True
)

def correct_skew(image, delta=1, limit=5):
    """Correct image skew using projection profile method"""
    def determine_score(arr, angle):
        data = inter.rotate(arr, angle, reshape=False, order=0)
        histogram = np.sum(data, axis=1, dtype=float)
        score = np.sum((histogram[1:] - histogram[:-1]) ** 2, dtype=float)
        return histogram, score
    
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    scores = []
    angles = np.arange(-limit, limit + delta, delta)
    for angle in angles:
        histogram, score = determine_score(thresh, angle)
        scores.append(score)
    best_angle = angles[scores.index(max(scores))]
    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, best_angle, 1.0)
    corrected = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    return best_angle, corrected

def calculate_aspect_ratio(width, height):
    """Calculate simplified aspect ratio"""
    gcd = math.gcd(int(width), int(height))
    simplified_width = int(width) // gcd
    simplified_height = int(height) // gcd
    return f"{simplified_width}:{simplified_height}", simplified_width / simplified_height

def find_mask_corners(mask):
    """Find corners of detected mask"""
    contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        largest_contour = max(contours, key=cv2.contourArea)
        epsilon = 0.02 * cv2.arcLength(largest_contour, True)
        approx = cv2.approxPolyDP(largest_contour, epsilon, True)
        if len(approx) == 4:
            return approx.reshape(4, 2).astype(np.float32)
        else:
            rect = cv2.minAreaRect(largest_contour)
            box = cv2.boxPoints(rect)
            return box.astype(np.float32)
    return None

def evaluate_mask_shape(mask):
    """Evaluate mask shape quality"""
    contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return 0
    largest_contour = max(contours, key=cv2.contourArea)
    epsilon = 0.02 * cv2.arcLength(largest_contour, True)
    approx = cv2.approxPolyDP(largest_contour, epsilon, True)
    shape_score = 0
    if len(approx) == 4:
        shape_score += 10
    area = cv2.contourArea(largest_contour)
    hull = cv2.convexHull(largest_contour)
    hull_area = cv2.contourArea(hull)
    if hull_area > 0:
        solidity = area / hull_area
        shape_score += solidity * 5
    perimeter = cv2.arcLength(largest_contour, True)
    if perimeter > 0:
        circularity = 4 * np.pi * area / (perimeter * perimeter)
        rectangularity = 1 - circularity
        shape_score += rectangularity * 3
    return shape_score

def calculate_mask_area(mask):
    """Calculate mask area"""
    return np.sum(mask)

def is_four_sided_shape(mask):
    """Check if mask represents a four-sided shape"""
    contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return False
    largest_contour = max(contours, key=cv2.contourArea)
    epsilon = 0.02 * cv2.arcLength(largest_contour, True)
    approx = cv2.approxPolyDP(largest_contour, epsilon, True)
    return len(approx) == 4

def check_minimum_width(mask, min_width=20):
    """Check if mask meets minimum width requirement"""
    mask_coords = np.where(mask)
    if len(mask_coords[0]) > 0:
        min_x, max_x = np.min(mask_coords[1]), np.max(mask_coords[1])
        width = max_x - min_x + 1
        return width >= min_width
    return False

def meets_mandatory_requirements(mask, max_aspect_distance=0.5):
    """Check if mask meets mandatory requirements"""
    if not is_four_sided_shape(mask):
        return False, "Not 4-sided"
    if not check_minimum_width(mask):
        return False, "Width < 20px"
    mask_coords = np.where(mask)
    if len(mask_coords[0]) == 0:
        return False, "Empty mask"
    return True, "Valid"

def order_points(pts):
    """Order points in top-left, top-right, bottom-right, bottom-left order"""
    rect = np.zeros((4, 2), dtype=np.float32)
    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect

def extract_bounding_boxes(ocr_results: List[dict]) -> List[dict]:
    """Extract bounding boxes from OCR results"""
    all_boxes = []
    
    for page_idx, result in enumerate(ocr_results):
        # Method 1: Using rec_boxes (if available)
        if 'rec_boxes' in result and len(result['rec_boxes']) > 0:
            for i, box in enumerate(result['rec_boxes']):
                bbox_info = {
                    'bbox': box.tolist(),
                    'text': result['rec_texts'][i] if i < len(result['rec_texts']) else '',
                    'score': result['rec_scores'][i] if i < len(result['rec_scores']) else 0,
                    'type': 'rec_box'
                }
                all_boxes.append(bbox_info)
        
        # Method 2: Using rec_polys (polygon format)
        elif 'rec_polys' in result and len(result['rec_polys']) > 0:
            for i, poly in enumerate(result['rec_polys']):
                x_coords = poly[:, 0]
                y_coords = poly[:, 1]
                x1, y1 = np.min(x_coords), np.min(y_coords)
                x2, y2 = np.max(x_coords), np.max(y_coords)
                
                bbox_info = {
                    'bbox': [x1, y1, x2, y2],
                    'polygon': poly.tolist(),
                    'text': result['rec_texts'][i] if i < len(result['rec_texts']) else '',
                    'score': result['rec_scores'][i] if i < len(result['rec_scores']) else 0,
                    'type': 'polygon'
                }
                all_boxes.append(bbox_info)
        
        # Method 3: Using dt_polys (detection polygons)
        elif 'dt_polys' in result and len(result['dt_polys']) > 0:
            for i, poly in enumerate(result['dt_polys']):
                x_coords = poly[:, 0]
                y_coords = poly[:, 1]
                x1, y1 = np.min(x_coords), np.min(y_coords)
                x2, y2 = np.max(x_coords), np.max(y_coords)
                
                bbox_info = {
                    'bbox': [x1, y1, x2, y2],
                    'polygon': poly.tolist(),
                    'text': result['rec_texts'][i] if i < len(result['rec_texts']) else '',
                    'score': result['rec_scores'][i] if i < len(result['rec_scores']) else 0,
                    'type': 'detection'
                }
                all_boxes.append(bbox_info)
    
    return all_boxes

def run_ocr_pipeline(image_data: str) -> Dict:
    """
    Complete OCR pipeline function
    
    Args:
        image_data: Base64 encoded image data or image path
        
    Returns:
        Dictionary with success status and OCR results
    """
    try:
        # Handle both base64 data and file paths
        if image_data.startswith('data:image'):
            # Remove data URL prefix if present
            image_data = image_data.split(',')[1]
        
        if len(image_data) < 100:  # Likely a file path
            with open(image_data, 'rb') as f:
                img_data = base64.b64encode(f.read()).decode('utf-8')
        else:
            img_data = image_data
            
        # Decode image
        nparr = np.frombuffer(base64.b64decode(img_data), np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        original_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        h, w = original_rgb.shape[:2]
        
        # Run YOLO segmentation
        results = model(cv2.resize(img.copy(), (imgsz, imgsz)), verbose=False, conf=0.4, device='cuda')
        ocr_results = []
        
        if results[0].masks is not None:
            # Process detections
            boxes = [[x1, y1, x2, y2, score] for x1, y1, x2, y2, score, _ in results[0].boxes.data.tolist()]
            mask_indices = np.argsort([mask[0][0] for mask in results[0].masks.data.tolist()])
            box_indices = np.argsort([box[0] for box in boxes])
            index_mapping = dict(zip(box_indices, range(len(boxes))))
            tracked_masks = [results[0].masks.data.tolist()[mask_indices[index_mapping[i]]] 
                            for i in range(len(boxes)) if i in index_mapping]

            # Process each detected object
            for mask_idx, (box, mask) in enumerate(zip(boxes, tracked_masks)):
                xyxy = np.array(box[:4])
                x1, y1, x2, y2 = map(int, xyxy)
                scale_x, scale_y = w / imgsz, h / imgsz
                x1, y1, x2, y2 = int(x1 * scale_x), int(y1 * scale_y), int(x2 * scale_x), int(y2 * scale_y)
                
                # Add padding
                padding = 50
                x1_pad = max(0, x1 - padding)
                y1_pad = max(0, y1 - padding)
                x2_pad = min(w, x2 + padding)
                y2_pad = min(h, y2 + padding)
                
                # Crop region
                cropped_no_pad = original_rgb[y1:y2, x1:x2]
                if cropped_no_pad.size == 0:
                    continue
                
                # Process mask
                mask_data = np.array(mask[:-2])
                enhanced_mask = mask_data > 0.5
                is_valid, reason = meets_mandatory_requirements(enhanced_mask)
                
                # Determine working image
                if is_valid:
                    mask_coords = np.where(enhanced_mask)
                    min_y, max_y = np.min(mask_coords[0]), np.max(mask_coords[0])
                    min_x, max_x = np.min(mask_coords[1]), np.max(mask_coords[1])
                    mask_width = max_x - min_x + 1
                    mask_height = max_y - min_y + 1
                    aspect_str, aspect_float = calculate_aspect_ratio(mask_width, mask_height)
                    shape_score = evaluate_mask_shape(enhanced_mask)
                    area = calculate_mask_area(enhanced_mask)
                    valid_candidate = {'mask': enhanced_mask, 'image': original_rgb, 'name': 'full', 'shape_score': shape_score, 'area': area}
                else:
                    valid_candidate = None
                
                if valid_candidate is None:
                    working_image = cv2.cvtColor(cropped_no_pad, cv2.COLOR_RGB2BGR)
                else:
                    working_image = cv2.cvtColor(cropped_no_pad, cv2.COLOR_RGB2BGR)

                # Correct skew and preprocess
                _, corrected_bgr = correct_skew(working_image)
                final_gray = cv2.cvtColor(corrected_bgr, cv2.COLOR_BGR2GRAY)
                _, thresholded = cv2.threshold(final_gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                
                # Run OCR
                try:
                    final_img = cv2.cvtColor(thresholded, cv2.COLOR_GRAY2RGB)
                    result = ocr.predict(final_img)
                    if result and result[0]:
                        ocr_texts = result[0].get('rec_texts', [])
                        confidences = result[0].get('rec_scores', [])
                        
                        if ocr_texts:
                            ocr_results.extend(extract_bounding_boxes(result))
                except Exception as e:
                    print(f"OCR Error: {str(e)}")
                    continue
        
        return {'success': True, 'results': ocr_results}
        
    except Exception as e:
        return {'success': False, 'error': str(e)}