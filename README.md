# AI Risk Manager - Financial Fraud Detection

AI Risk Manager is an end-to-end financial fraud detection and risk scoring platform combining machine learning, anomaly detection, explainability, and intelligent retrieval-augmented generation (RAG).

---

## 🛠️ Environment Setup & Local Execution

### 1. Prerequisites
- Python 3.10+ (or Python 3.11/3.12)
- Git

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
│   ├── feature_engineering.py
│   ├── model_training.py
│   ├── model_inference.py
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
├── .gitignore
├── requirements.txt
├── README.md
└── Dockerfile
```
