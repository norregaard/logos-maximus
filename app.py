from __future__ import annotations

import json
import random
from pathlib import Path
from flask import Flask, jsonify, render_template, request, abort
import hashlib
import time


app = Flask(__name__)


_QUOTES_CACHE: list[dict] | None = None
_RATE_LIMIT: dict[str, list[float]] = {}


def _norm(s: str) -> str:
    if s is None:
        return ""
    # Normalize whitespace and some punctuation for duplicate detection
    s = s.strip()
    # Replace typographic quotes/dashes with plain equivalents
    trans = str.maketrans({
        "“": '"', "”": '"', "‘": "'", "’": "'",
        "–": "-", "—": "-",
        "…": "...",
    })
    s = s.translate(trans)
    # Collapse multiple spaces
    while "  " in s:
        s = s.replace("  ", " ")
    return s


def load_quotes() -> list[dict]:
    global _QUOTES_CACHE
    if _QUOTES_CACHE is not None:
        return _QUOTES_CACHE

    data_path = Path(__file__).parent / "quotes.json"
    try:
        with data_path.open("r", encoding="utf-8") as f:
            data = json.load(f)
            if not isinstance(data, list):
                raise ValueError("quotes.json must contain a list of objects")
            # Normalize shape to {text, author} and de-duplicate
            normalized: list[dict] = []
            seen: set[tuple[str, str]] = set()
            for item in data:
                if not isinstance(item, dict):
                    continue
                raw_text = item.get("text") or item.get("quote")
                raw_author = item.get("author")
                if not raw_text:
                    continue
                text = _norm(str(raw_text))
                author = _norm(str(raw_author)) if raw_author is not None else ""
                key = (text.lower(), author.lower())
                if key in seen:
                    continue
                seen.add(key)
                normalized.append({"text": text, "author": author})
            if not normalized:
                raise ValueError("quotes.json contained no valid quotes")
            # Infer categories if missing
            for q in normalized:
                if not q.get("category"):
                    q["category"] = infer_category(q.get("author", ""))

            _QUOTES_CACHE = normalized
            return _QUOTES_CACHE
    except Exception:
        # Fallback quotes if file is missing or invalid
        _QUOTES_CACHE = [
            {"text": "The impediment to action advances action. What stands in the way becomes the way.", "author": "Marcus Aurelius"},
            {"text": "We suffer more often in imagination than in reality.", "author": "Seneca"},
            {"text": "It’s not what happens to you, but how you react to it that matters.", "author": "Epictetus"},
        ]
        for q in _QUOTES_CACHE:
            q["category"] = infer_category(q.get("author", ""))
        return _QUOTES_CACHE


def infer_category(author: str) -> str:
    a = (author or "").lower()
    if any(k in a for k in ["marcus aurelius", "seneca", "epictetus", "zeno"]):
        return "Stoicism"
    if any(k in a for k in ["heraclitus", "diogenes"]):
        return "Pre-Socratic"
    if any(k in a for k in ["socrates", "plato"]):
        return "Platonic"
    if "aristotle" in a:
        return "Peripatetic"
    return "Classics"


def quote_id(text: str, author: str) -> str:
    base = f"{text}\u241f{author}".encode("utf-8")
    return hashlib.sha1(base).hexdigest()[:10]


def apply_filters(quotes: list[dict]) -> list[dict]:
    category = request.args.get("category")
    length = request.args.get("length")  # 'short' or 'long'
    q = request.args.get("q")  # simple search in text/author

    def ok(item: dict) -> bool:
        if category and item.get("category") != category:
            return False
        if length == "short" and len(item.get("text", "")) > 120:
            return False
        if length == "long" and len(item.get("text", "")) <= 120:
            return False
        if q:
            s = (item.get("text", "") + " " + item.get("author", "")).lower()
            if q.lower() not in s:
                return False
        return True

    return [i for i in quotes if ok(i)]


def pick_quote(quotes: list[dict]) -> dict:
    mode = request.args.get("mode")  # 'daily' or None
    if mode == "daily":
        # Deterministic by date
        day_seed = int(time.strftime("%Y%m%d"))
        random.seed(day_seed)
    try:
        choice = random.choice(quotes)
    finally:
        if mode == "daily":
            random.seed()  # reset RNG
    return choice


def with_rate_limit(func):
    def wrapper(*args, **kwargs):
        # Very small per-IP sliding window limit: 60 req/min
        ip = request.headers.get("X-Forwarded-For", request.remote_addr) or "anon"
        now = time.time()
        window = 60.0
        bucket = _RATE_LIMIT.setdefault(ip, [])
        bucket[:] = [t for t in bucket if now - t < window]
        if len(bucket) >= 60:
            return jsonify({"error": "Too many requests"}), 429
        bucket.append(now)
        return func(*args, **kwargs)
    wrapper.__name__ = func.__name__  # preserve name for Flask
    return wrapper


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/quote")
@with_rate_limit
def api_quote():
    quotes = load_quotes()

    # Specific by id
    id_param = request.args.get("id")
    if id_param:
        for item in quotes:
            if quote_id(item.get("text", ""), item.get("author", "")) == id_param:
                item = dict(item)
                item["id"] = id_param
                return jsonify(item)
        abort(404)

    filtered = apply_filters(quotes)
    if not filtered:
        return jsonify({"error": "No quotes matched filters"}), 404
    item = pick_quote(filtered)
    item = dict(item)
    item["id"] = quote_id(item.get("text", ""), item.get("author", ""))
    return jsonify(item)


@app.route("/api/quotes")
@with_rate_limit
def api_quotes():
    quotes = load_quotes()
    filtered = apply_filters(quotes)
    # Return a small slice to avoid huge payloads
    out = []
    for item in filtered[:100]:
        out.append({
            "id": quote_id(item.get("text", ""), item.get("author", "")),
            "text": item.get("text", ""),
            "author": item.get("author", ""),
            "category": item.get("category", ""),
        })
    return jsonify({"count": len(filtered), "items": out})


if __name__ == "__main__":
    # For local development
    app.run(debug=True)
