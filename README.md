# AI Risk Manager - Financial Fraud Detection

AI Risk Manager is an end-to-end financial fraud detection and risk scoring platform combining machine learning, anomaly detection, explainability, and intelligent retrieval-augmented generation (RAG).

---

## 🛠️ Environment Setup & Local Execution

### 1. Prerequisites
- Python 3.10+ (or Python 3.11/3.12)
- Git
- PostgreSQL 14+ (for prediction persistence)

---

### 2. PostgreSQL Setup (Local Development)

#### Option A — Install PostgreSQL Locally

1. Download and install [PostgreSQL](https://www.postgresql.org/download/) (includes `pgAdmin` and the `psql` CLI).

2. Create a database and user:
   ```sql
   -- Connect as the default superuser
   psql -U postgres

   CREATE USER ai_risk_user WITH PASSWORD 'your_password';
   CREATE DATABASE ai_risk_manager OWNER ai_risk_user;
   GRANT ALL PRIVILEGES ON DATABASE ai_risk_manager TO ai_risk_user;
   \q
   ```

3. Copy the example environment file and fill in your credentials:
   ```bash
   cp .env.example .env
   # Edit .env with your actual PostgreSQL credentials
   ```

   > **Important:** Never commit `.env` to version control. It is already listed in `.gitignore`.

#### Option B — Docker (No Local Install)

```bash
docker run -d \
  --name ai-risk-pg \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=changeme \
  -e POSTGRES_DB=ai_risk_manager \
  -p 5432:5432 \
  postgres:16-alpine
```

Then create the `.env` file matching these credentials.

#### Tables

The application automatically creates two tables on startup:

| Table | Description |
|---|---|
| `transactions` | Raw transaction data received by the API |
| `risk_predictions` | Model output — fraud probability, risk score, decision, and model version |

---

### 2. Virtual Environment Setup

#### Windows (PowerShell / Command Prompt)
```powershell
# Create virtual environment (if not already created)
python -m venv .venv

# Activate virtual environment in PowerShell
.\.venv\Scripts\Activate.ps1

# (Alternative) In Command Prompt (cmd.exe)
.\.venv\Scripts\activate.bat
```

> **Note for PowerShell Users**: If script execution is restricted, run:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
> ```

#### macOS / Linux (Bash / Zsh)
```bash
# Create virtual environment
python3 -m venv .venv

# Activate virtual environment
source .venv/bin/activate
```

---

### 3. Install Dependencies

With the virtual environment activated, install the required packages:

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

---

### 4. Running the Project Locally

#### Start the FastAPI Application
```bash
uvicorn api.main:app --reload --host 127.0.0.1 --port 8000
```
- Interactive API Docs (Swagger): [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- Alternative Docs (ReDoc): [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

#### Launch Jupyter Notebook for Exploratory Data Analysis (EDA)
```bash
jupyter notebook notebooks/EDA.ipynb
# or
jupyter lab
```

#### Run Tests
```bash
pytest
# or
python -m unittest discover -s tests
```

---

## 📁 Project Structure

```text
ai-risk-manager/
├── data/
│   ├── raw/
│   ├── processed/
│   └── knowledge_base/
├── notebooks/
│   └── EDA.ipynb
├── src/
│   ├── __init__.py
│   ├── config.py
│   ├── data_loader.py
│   ├── database.py
│   ├── feature_engineering.py
│   ├── model_training.py
│   ├── model_inference.py
│   ├── models_db.py
│   ├── anomaly_detection.py
│   ├── risk_scoring.py
│   ├── explainability.py
│   └── utils.py
├── api/
│   ├── __init__.py
│   ├── main.py
│   └── routes.py
├── rag/
│   ├── __init__.py
│   ├── document_loader.py
│   ├── chunking.py
│   ├── embeddings.py
│   ├── vector_store.py
│   ├── retriever.py
│   └── rag_pipeline.py
├── frontend/
├── models/
├── tests/
│   ├── test_data.py
│   ├── test_model.py
│   └── test_api.py
├── .env
├── .env.example
├── .gitignore
├── requirements.txt
├── README.md
└── Dockerfile
```
