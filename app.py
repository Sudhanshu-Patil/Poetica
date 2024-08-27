from flask import Flask, render_template, request, jsonify
import google.generativeai as genai
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
from emotions import analyze_emotions
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
@app.route('/')
def home():
    return render_template('index.html')  

@app.route('/generate_poem', methods=['POST'])
def generate_poem():
    data = request.get_json()
    user_prompt = data.get('prompt','')
    directive = "Write a poem based on the following prompt: "
    full_prompt = f"{directive}{user_prompt}"
    try:
        api_key = os.getenv('GEMINI_API_KEY')
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        # Generate poem using Gemini with prompt
        response = model.generate_content(full_prompt)
        poem = response.text.strip()
        top_emotion, emotions = analyze_emotions(poem)
        return jsonify({"poem": poem,
            'top_emotion': top_emotion,
            'emotions': emotions
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
        
if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))  # Use the port from the environment variable or default to 5000
    app.run(host='0.0.0.0', port=port)
