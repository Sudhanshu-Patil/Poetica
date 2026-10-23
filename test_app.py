"""Run: python test_app.py — no network or API keys needed."""
import json

import app
from emotions import parse_scores


def test_parse_scores():
    rows = [{"label": "joy", "score": 0.2}, {"label": "sadness", "score": 0.7}]
    assert list(parse_scores([rows])) == ["sadness", "joy"]
    assert parse_scores(rows) == parse_scores([rows])


def test_build_messages():
    msgs = app.build_messages({"prompt": "rain", "form": "rm -rf", "language": "Hindi"})
    assert "free verse about: rain" in msgs[0]["content"] and "Hindi" in msgs[0]["content"]
    refine = app.build_messages({"prompt": "rain", "poem": "Old poem", "instruction": "darker"})
    assert [m["role"] for m in refine] == ["user", "assistant", "user"]


def test_steer_revises_until_target():
    readings = iter([("sadness", {"sadness": 0.8, "joy": 0.2}), ("joy", {"joy": 0.9, "sadness": 0.1})])
    seen = []
    app.complete = lambda msgs: seen.append(len(msgs)) or f"Draft {len(seen)}\n\nline"
    app.analyze_emotions = lambda poem: next(readings)
    events = list(app.steer([{"role": "user", "content": "x"}], "joy"))
    assert [e["hit"] for e in events] == [False, True]
    assert seen == [1, 3]  # second round carries the draft and the classifier's feedback


def test_steer_stops_at_max_rounds():
    app.complete = lambda msgs: "T\n\nP"
    app.analyze_emotions = lambda poem: ("fear", {"fear": 1.0})
    assert len(list(app.steer([], "joy"))) == app.MAX_ROUNDS


def test_routes_validate_input():
    client = app.app.test_client()
    assert client.post("/api/write", json={}).status_code == 400
    assert client.post("/api/steer", json={"prompt": "x", "target": "boredom"}).status_code == 400
    res = client.post("/api/steer", json={"prompt": "x", "target": "joy"})
    assert json.loads(res.data.splitlines()[0])["round"] == 1


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
