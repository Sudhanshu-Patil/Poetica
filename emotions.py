import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

def analyze_emotions(poem):
    # Load the tokenizer and model
    tokenizer = AutoTokenizer.from_pretrained("bhadresh-savani/distilbert-base-uncased-emotion")
    model = AutoModelForSequenceClassification.from_pretrained("bhadresh-savani/distilbert-base-uncased-emotion")
    
    # Tokenize the input text
    inputs = tokenizer(poem, return_tensors="pt")
    
    # Get the logits from the model
    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits
    
    # Apply softmax to get probabilities
    probabilities = torch.nn.functional.softmax(logits, dim=-1)
    
    # Get the emotion labels from the model config
    emotion_labels = model.config.id2label
    
    # Convert probabilities to a dictionary mapping emotions to scores
    emotions = {emotion_labels[i]: prob.item() for i, prob in enumerate(probabilities[0])}
    
    # Sort emotions by score in descending order
    sorted_emotions = dict(sorted(emotions.items(), key=lambda item: item[1], reverse=True))
    top_emotion = max(sorted_emotions, key=sorted_emotions.get)
    return top_emotion, sorted_emotions