import json
import os
import urllib.error
import urllib.request

HF_URL = "https://router.huggingface.co/hf-inference/models/bhadresh-savani/distilbert-base-uncased-emotion"


def parse_scores(rows):
    """HF returns [[{label, score}, ...]] or [{label, score}, ...]; return labels sorted by score."""
    if rows and isinstance(rows[0], list):
        rows = rows[0]
    return {r["label"]: r["score"] for r in sorted(rows, key=lambda r: -r["score"])}


def analyze_emotions(text):
    if not os.getenv("HF_TOKEN"):
        raise RuntimeError("HF_TOKEN is not set")
    # DistilBERT reads at most 512 tokens; poems fit, this just guards very long input
    body = {"inputs": text[:1500], "parameters": {"top_k": 6}}
    req = urllib.request.Request(HF_URL, data=json.dumps(body).encode(), headers={
        "Authorization": f"Bearer {os.getenv('HF_TOKEN')}",
        "Content-Type": "application/json",
        "User-Agent": "Poetica/2.0",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            scores = parse_scores(json.load(resp))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Hugging Face error {e.code}: {e.read().decode(errors='replace')[:200]}") from e
    return next(iter(scores)), scores
