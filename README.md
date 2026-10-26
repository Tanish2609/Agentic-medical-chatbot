# MedGuide AI

A medical education chatbot built with FastAPI, LangGraph, OpenAI, and Pinecone. It looks through a medical PDF knowledge base first and can use web search when a question needs current information.

This project is for learning and educational guidance. It is not a diagnostic tool and does not replace a doctor.

## What it can do

- Search a medical PDF using semantic search.
- Show the page numbers used from the PDF.
- Fall back to web research for current guidance or weak PDF matches.
- Accept an optional image and describe visible features without diagnosing.
- Accept voice input and read answers aloud.
- Keep local conversation state in SQLite.

## Project structure

```text
app/
  agent.py        LangGraph workflow
  config.py       Environment settings
  knowledge.py    Pinecone search and embeddings
  main.py         FastAPI routes
data/             Source PDF
static/           CSS and browser JavaScript
template/         Chat page HTML
ingest.py         PDF ingestion script
test.py           Basic graph test
```

## Setup

Use Python 3.14 or newer.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=your_openai_key
PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX=medical-agent-demo

# Optional: enables web research for current questions
TAVILY_API_KEY=your_tavily_key

# Optional: protects the API with a bearer token
API_TOKEN=your_local_token
```

Do not commit `.env`. It is already ignored by Git.

## Add the PDF to Pinecone

Put the PDF inside `data/`, then run:

```powershell
python ingest.py --pdf data/Medical_book.pdf
```

The script reads the PDF page by page, creates overlapping text chunks, generates embeddings, and stores them in Pinecone.

## Run the app

```powershell
uvicorn app.main:app --reload
```

Open the chat page at [http://127.0.0.1:8000](http://127.0.0.1:8000). API documentation is available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

## API routes

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Checks server and API-key configuration. |
| `POST /api/chat` | Sends a question, optional image, and recent history to the agent. |
| `POST /api/transcribe` | Converts recorded audio into text. |
| `POST /api/speak` | Converts an answer into speech. |

## Notes

- The current PDF is a historical source. The app prefers current web guidance for time-sensitive questions when Tavily is configured.
- Image responses are limited to visible observations, not diagnoses.
- `medical_memory.db` stores local conversation state and is intentionally ignored by Git.

