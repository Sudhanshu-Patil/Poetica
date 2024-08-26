from flask import Flask, render_template, request, jsonify
import google.generativeai as genai
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
from emotions import analyze_emotions
import os
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
        genai.configure(api_key=os.environ.get('GEMINI_API_KEY')) #use your api key
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
    app.run(debug=True)
