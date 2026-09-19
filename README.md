# Riva AI — Full Stack Application 🚀

Riva AI is an intelligent conversational AI assistant built with FastAPI (Python) on the backend and Next.js (TypeScript) on the frontend. It is powered by Neon Lakebase Postgres and local Ollama inference, providing a seamless and highly responsive chat experience.

---

## ✨ Features

- **Conversational AI Interface**: Interactive chat UI powered by Next.js and Tailwind CSS.
- **Local LLM Inference**: Integrated with Ollama for running models (like Llama 3) locally.
- **Robust Backend**: Built on FastAPI for high performance and async capabilities.
- **Postgres Database**: Uses Neon Serverless Postgres with `asyncpg` for fast and scalable data storage.
- **Authentication**: JWT-based secure authentication system with role-based access control (e.g., Admin Dashboard).
- **Responsive Design**: Mobile-friendly, modern glassmorphism aesthetic.

---

## 🛠 Technology Stack

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS
- **Backend**: FastAPI, Python, asyncpg, bcrypt, PyJWT
- **Database**: Neon (Postgres)
- **AI/LLM**: Ollama (llama3.1:8b)

---

## 🚀 Getting Started (Local Development)

Follow these instructions to set up the project locally on your machine.

### Prerequisites
- Node.js (v18+)
- Python (3.9+)
- [Ollama](https://ollama.com/) (running locally)
- PostgreSQL database (or [Neon](https://neon.tech/) account)

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/shahidurAI.git
cd shahidurAI
```

### 2. Backend Setup

Navigate to the `backend/` directory, set up your virtual environment, and install dependencies:

```bash
cd backend
python -m venv .venv

# On Windows:
.venv\Scripts\Activate.ps1
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
```

Set up your environment variables:

```bash
cp .env.example .env
```

Ensure your `backend/.env` is configured correctly:
```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1:8b
DATABASE_URL="postgresql://<user>:<password>@<host>/<dbname>?sslmode=require"
JWT_SECRET="generate_a_strong_secret_key"
ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
```

Start the FastAPI backend server:

```bash
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup

Open a new terminal, navigate to the `frontend/` directory, and install the dependencies:

```bash
cd frontend
npm install
```

Set up your frontend environment variables:

```bash
cp .env.local.example .env.local
```

Ensure your `frontend/.env.local` points to the local backend:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the Next.js development server:

```bash
npm run dev
```

### 4. Running Ollama

Make sure Ollama is running in the background and that you have pulled the necessary model:
```bash
ollama run llama3.1:8b
```

---

## 🔒 Security Best Practices

- **Rotate Database Credentials**: Never commit your database credentials. Use `.env`.
- **JWT Secrets**: Always use cryptographically secure strings for `JWT_SECRET`.
- **Git Ignore**: Ensure `.env` and `.env.local` files remain listed in `.gitignore`.

---

## 👨‍💻 Author

**MD. SHAHIDUR RAHMAN**  
Portfolio: [SHAHIDUR.ME](https://shahidur.me)

---
*Feel free to star ⭐ this repository if you found it helpful!*
