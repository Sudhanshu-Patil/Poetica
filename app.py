import json
import os
import urllib.error
import urllib.request

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, render_template, request, stream_with_context

load_dotenv()

app = Flask(__name__)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
FORMS = {"free verse", "haiku", "sonnet", "limerick", "ghazal", "villanelle"}
MOODS = {"joy", "sadness", "love", "anger", "fear", "surprise"}
MAX_ROUNDS = 4
SYSTEM = ("You are Poetica, a gifted poet. Reply with only the poem: a short title on the first line, "
          "a blank line, then the poem. No markdown, no quotation marks, no commentary.")
CRITIC = ("You are an emotion classifier. Rate how strongly the text expresses each of: "
          "joy, love, sadness, anger, fear, surprise. Reply with only a JSON object mapping "
          'each of those six labels to a score from 0 to 1, e.g. {"joy": 0.7, "love": 0.2, ...}.')


def groq(messages, stream=False, system=SYSTEM, temperature=0.9, json_mode=False):
    """Open a chat completion request to Groq (OpenAI-compatible API)."""
    if not os.getenv("GROQ_API_KEY"):
        raise RuntimeError("GROQ_API_KEY is not set")
    body = {"model": MODEL, "messages": [{"role": "system", "content": system}, *messages],
            "temperature": temperature, "stream": stream}
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    req = urllib.request.Request(GROQ_URL, data=json.dumps(body).encode(), headers={
        "Authorization": f"Bearer {os.getenv('GROQ_API_KEY')}",
        "Content-Type": "application/json",
        "User-Agent": "Poetica/2.0",
    })
    try:
        return urllib.request.urlopen(req, timeout=60)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Groq error {e.code}: {e.read().decode(errors='replace')[:200]}") from e


def complete(messages):
    with groq(messages) as resp:
        return json.load(resp)["choices"][0]["message"]["content"].strip()


def normalize(raw):
    """Keep the six moods, clamp to >= 0, scale to sum 1, sort by score."""
    scores = {m: max(float(raw.get(m) or 0), 0.0) for m in MOODS}
    total = sum(scores.values()) or 1
    return {m: s / total for m, s in sorted(scores.items(), key=lambda kv: -kv[1])}


def analyze_emotions(text):
    with groq([{"role": "user", "content": text[:4000]}], system=CRITIC, temperature=0, json_mode=True) as resp:
        raw = json.loads(json.load(resp)["choices"][0]["message"]["content"])
    scores = normalize(raw)
    return next(iter(scores)), scores


def stream_text(resp):
    """Yield text deltas from Groq's server-sent events."""
    with resp:
        for raw in resp:
            line = raw.decode().strip()
            if line.startswith("data: ") and line != "data: [DONE]":
                delta = json.loads(line[6:])["choices"][0]["delta"].get("content")
                if delta:
                    yield delta


def build_messages(data):
    form = data.get("form") if data.get("form") in FORMS else "free verse"
    ask = f"Write a {form} about: {str(data.get('prompt', ''))[:1000]}"
    if language := str(data.get("language", "")).strip()[:40]:
        ask += f"\nLanguage: {language}."
    if poet := str(data.get("poet", "")).strip()[:60]:
        ask += f"\nWrite in the style of {poet}."
    messages = [{"role": "user", "content": ask}]
    # Refinement: continue the conversation from the current poem
    if (poem := str(data.get("poem", ""))[:4000]) and (note := str(data.get("instruction", "")).strip()[:300]):
        messages += [{"role": "assistant", "content": poem},
                     {"role": "user", "content": f"Revise the poem: {note}"}]
    return messages


def steer(messages, target):
    """Write, score with the emotion model, and revise until the target mood wins."""
    for round_no in range(1, MAX_ROUNDS + 1):
        poem = complete(messages)
        top, scores = analyze_emotions(poem)
        yield {"round": round_no, "poem": poem, "top": top, "emotions": scores, "hit": top == target}
        if top == target:
            return
        reading = ", ".join(f"{k} {v:.0%}" for k, v in scores.items())
        messages = messages + [
            {"role": "assistant", "content": poem},
            {"role": "user", "content": f"An emotion classifier read this poem as: {reading}. "
                                        f"Revise it so {target} clearly dominates. Keep the form and the subject."},
        ]


@app.route('/')
def home():
    return render_template('index.html')


@app.post('/api/write')
def write():
    data = request.get_json(silent=True) or {}
    if not str(data.get("prompt", "")).strip():
        return jsonify({"error": "Give the poem a subject first."}), 400
    try:
        resp = groq(build_messages(data), stream=True)
    except Exception as e:
        return jsonify({"error": str(e)}), 502
    return Response(stream_with_context(stream_text(resp)), mimetype="text/plain")


@app.post('/api/steer')
def steer_route():
    data = request.get_json(silent=True) or {}
    target = data.get("target")
    if not str(data.get("prompt", "")).strip() or target not in MOODS:
        return jsonify({"error": "Pick a subject and a target mood."}), 400

    def events():
        try:
            for event in steer(build_messages(data), target):
                yield json.dumps(event) + "\n"
        except Exception as e:
            yield json.dumps({"error": str(e)}) + "\n"

    return Response(stream_with_context(events()), mimetype="application/x-ndjson")


@app.post('/api/emotions')
def emotions():
    text = str((request.get_json(silent=True) or {}).get("text", "")).strip()
    if not text:
        return jsonify({"error": "No text to analyse."}), 400
    try:
        top, scores = analyze_emotions(text)
    except Exception as e:
        return jsonify({"error": str(e)}), 502
    return jsonify({"top": top, "emotions": scores})


if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))  # Use the port from the environment variable or default to 5000
    app.run(host='0.0.0.0', port=port)
