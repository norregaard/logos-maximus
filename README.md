# LogosMaximus

> "The obstacle is the way. But also… refresh the page for another quote."

LogosMaximus is a simple web app that serves Stoic and Ancient Greek quotes. Marcus Aurelius meets modern web — bite-sized wisdom with a clean UI.

---

## ✨ Features
- 🎲 Random or Daily quote mode
- 🏛️ Greek & Roman sources (Marcus, Seneca, Epictetus, etc.)
- 🌙 Light/Dark theme toggle
- ❤️ Favorites (localStorage), with a Favorites section
- 📤 Share and 📋 Copy to clipboard
- ⌨️ Shortcuts: `N`/Space new, `T` theme, `F` favorite, `S` share, `C` copy
- 🔎 Filters: categories and short quotes
- 🔗 Deep links via quote `id` (`/?id=...`)
- 🔄 API at `/api/quote` and `/api/quotes`

---

## 📦 Tech Stack
- Backend: Flask (Python)
- Frontend: HTML, CSS, vanilla JS
- Data: `quotes.json`

---

## 🚀 Getting Started

Local development with Flask:

```bash
# 1) Create & activate a virtualenv
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate

# 2) Install dependencies
pip install -r requirements.txt

# 3) Run the server
export FLASK_APP=app.py
export FLASK_ENV=development  # optional: enables auto-reload
flask run

# The app will be available at:
# http://127.0.0.1:5000/
```

Or, run directly:

```bash
python app.py
```

---

## 📁 Project Structure

```
logos-maximus/
├── app.py               # Flask entrypoint
├── quotes.json          # 15+ Stoic/Greek quotes
├── static/
│   ├── style.css        # Minimal, elegant styling + themes
│   └── script.js        # Fetch logic + theme toggle
├── templates/
│   └── index.html       # Frontend page
├── requirements.txt     # Python deps
└── README.md
```

---

## 🧪 API

Fetch a random quote:

```bash
curl http://127.0.0.1:5000/api/quote
```

Example response:

```json
{"text": "We suffer more often in imagination than in reality.", "author": "Seneca"}
```

Query parameters:
- `category`: `Stoicism`, `Pre-Socratic`, `Platonic`, `Peripatetic`, `Classics`
- `length`: `short` or `long` (threshold ~120 chars)
- `mode`: `daily` for deterministic quote of the day
- `id`: fetch specific quote by id (also works at `/?id=...`)

List quotes (first 100 matching) with metadata:

```bash
curl 'http://127.0.0.1:5000/api/quotes?category=Stoicism&length=short'
```

---

## 🧭 Stretch Ideas

- Categories (Stoicism, Epicureanism, Proverbs)
- Simple search
- Favorite quotes (localStorage)
