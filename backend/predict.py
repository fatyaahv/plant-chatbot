import tensorflow as tf
import numpy as np
from PIL import Image
import json
import io
import os

# Get the directory where this file is located
current_dir = os.path.dirname(os.path.abspath(__file__))

# Load model and class names once when server starts
model = tf.keras.models.load_model(os.path.join(current_dir, "models/plant_model.keras"))

with open(os.path.join(current_dir, "models/class_names.json"), "r") as f:
    class_names = json.load(f)

def predict_disease(image_bytes):
    # Open and preprocess image
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((224, 224))
    img_array = np.array(img)
    img_array = np.expand_dims(img_array, axis=0)
    
    # EfficientNet preprocessing
    img_array = tf.keras.applications.efficientnet.preprocess_input(img_array)
    
    # Predict
    predictions = model.predict(img_array)
    predicted_index = np.argmax(predictions[0])
    confidence = float(np.max(predictions[0])) * 100
    predicted_class = class_names[str(predicted_index)]
    
    # Clean up the class name for display
    parts = predicted_class.split("___")
    plant = parts[0].replace("_", " ")
    condition = parts[1].replace("_", " ") if len(parts) > 1 else "Unknown"
    
    return {
        "plant": plant,
        "condition": condition,
        "confidence": round(confidence, 2),
        "raw_label": predicted_class
    }