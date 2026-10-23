# Poetica: an AI poetry studio that listens for feeling

Poetica writes poems with an LLM and reads how they feel with a separate critic call. In **Steer to a mood** mode the two work as a loop: the poet drafts, the critic scores its emotions, and the poet revises from that feedback until the target mood wins.

Runs entirely on free tiers.

## Features

- **Emotion-steering agent:** pick a target mood (joy, love, sadness, anger, fear, surprise) and watch each draft and its emotion reading, round by round, until the poem lands.
- **Live streaming:** poems stream in token by token as they are written.
- **Refine in conversation:** "make it darker", "end on hope", "make it rhyme". Every revision is kept as a version you can flip back to.
- **Forms and styles:** free verse, haiku, sonnet, limerick, ghazal, villanelle, in any language and in the style of any poet.
- **Emotion breakdown:** an emotion reading of every poem; the page colour follows the poem's mood.
- **Read aloud and share:** read the poem aloud using the browser's built-in speech, or download it as an image card.

## Stack

| Part | Tech | Cost |
| --- | --- | --- |
| Poems | GPT-OSS 120B on [Groq](https://console.groq.com) | Free tier |
| Emotions | Same model as a JSON-mode critic on Groq | Free tier |
| Server | Flask (Python), using the standard library to call Groq | Free |
| Front end | HTML, CSS and vanilla JavaScript, no framework | Free |
| Hosting | Vercel | Free (Hobby) |

## Run locally

1. Get a free Groq key: https://console.groq.com/keys
2. Create a `.env` file:
   ```
   GROQ_API_KEY=your-groq-key
   # optional: GROQ_MODEL=openai/gpt-oss-120b
   ```
3. Install and run:
   ```bash
   pip install -r requirements.txt
   python app.py
   ```
4. Open http://127.0.0.1:5000

Tests (no keys or network needed): `python test_app.py`

## Deploy

Vercel deploys the Flask app from `main`. Add `GROQ_API_KEY` under **Project → Settings → Environment Variables**.

## License

MIT. See [LICENSE](LICENSE).
