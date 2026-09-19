# Riva AI — Full Stack Application 🚀

Riva AI is an intelligent conversational AI assistant built with FastAPI (Python) on the backend and Next.js (TypeScript) on the frontend. It is powered by Neon Lakebase Postgres and local Ollama inference, providing a seamless and highly responsive chat experience.

---

## ✨ Features

- **Conversational AI Interface**: Interactive chat UI powered by Next.js and Tailwind CSS.
- **Local LLM Inference**: Integrated with Ollama for running models (like Llama 3) locally or in Docker.
- **Robust Backend**: Built on FastAPI for high performance and async capabilities.
- **Postgres Database**: Uses Neon Serverless Postgres with `asyncpg` for fast and scalable data storage.
- **Authentication**: JWT-based secure authentication system with role-based access control (e.g., Admin Dashboard).
- **Responsive Design**: Mobile-friendly, modern glassmorphism aesthetic.
- **Docker Production Ready**: Containerized backend optimized for Linux ARM64 (Oracle Cloud VPS).

---

## 🛠 Technology Stack

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS (Deployed on Netlify)
- **Backend**: FastAPI, Python 3.12, asyncpg, bcrypt, PyJWT, Docker (Deployed on Oracle Cloud ARM64 VPS)
- **Database**: Neon Serverless Postgres
- **AI/LLM**: Ollama (`llama3.1:8b`)

---

## 🐳 Production Docker Deployment (VPS ARM64)

The backend is configured for deployment using Docker Compose on a Linux ARM64 / Ubuntu VPS.

### 1. Prerequisites on VPS
- Docker & Docker Compose installed.
- An existing Ollama container running on the VPS with container name `ollama`.
- Neon PostgreSQL connection URL.

### 2. Environment Setup
Copy `.env.production.example` to `.env` in the repository root on your VPS:

```bash
cp .env.production.example .env
```

Configure your VPS `.env` file with real credentials:
```env
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_KEEP_ALIVE=30m
OLLAMA_NUM_CTX=2048
OLLAMA_NUM_PREDICT=-1
OLLAMA_TEMPERATURE=0.7

DATABASE_URL="postgresql://username:password@ep-example.us-east-2.aws.neon.tech/neondb?sslmode=require"
JWT_SECRET="your_secure_random_jwt_secret"
ALLOWED_ORIGINS="https://ai.shahidur.me"
```

### 3. Network Configuration
Ensure your existing `ollama` container can communicate with `riva-api` over the dedicated Docker network (`riva-network`):

```bash
# Connect existing ollama container to riva-network
docker network connect riva-network ollama
```

### 4. Build and Launch
Deploy the production backend container:

```bash
docker compose -f compose.production.yml up -d --build
```

### 5. Verify Backend Health
Check that the backend container is running and healthy:

```bash
docker compose -f compose.production.yml ps
curl http://127.0.0.1:8000/api/health
```

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
git clone https://github.com/Shahidur8381/RivaAI---A-friendly-AI-assistant.git
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
- **Git Ignore**: Ensure `.env` and `.env.*` files remain listed in `.gitignore`.

---

## 👨‍💻 Author

**MD. SHAHIDUR RAHMAN**  
Portfolio: [SHAHIDUR.ME](https://shahidur.me)  
Email: [shahidur8381@gmail.com](mailto:shahidur8381@gmail.com)

---
*Feel free to star ⭐ this repository if you found it helpful!*
