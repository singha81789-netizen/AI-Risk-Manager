# AI Risk Manager

Real-time financial fraud detection system with ML-powered risk scoring, analyst workflow dashboard, and full audit trail.

## Architecture

```
React Dashboard (localhost:3000)
    ↓ Vite proxy
FastAPI Backend (localhost:8000)
    ↓
ML Model (RandomForestClassifier) → Risk Score (0-100) → Risk Level (LOW/MEDIUM/HIGH)
    ↓
PostgreSQL / SQLite → Persisted transactions, predictions, analyst reviews, audit logs
```

## Quick Start

### 1. Python Environment

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

pip install -r requirements.txt
```

### 2. Database

The system **automatically falls back to SQLite** if PostgreSQL is unavailable.
SQLite database is created at `data/ai_risk_manager.db`.

**Optional: PostgreSQL** (for production-like setup):

```bash
# Create database
psql -U postgres -c "CREATE DATABASE ai_risk_manager;"
```

Configure in `.env`:
```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=ai_risk_manager
```

### 3. Train the Model

```bash
python -c "from src.model_training import train_model; train_model()"
```

This creates:
- `models/risk_model.pkl` — trained RandomForestClassifier
- `models/preprocessor.joblib` — fitted preprocessing pipeline
- `models/anomaly_detector.joblib` — IsolationForest anomaly detector

### 4. Start the Backend

```bash
uvicorn api.main:app --reload --host 127.0.0.1 --port 8000
```

API docs: http://localhost:8000/docs

### 5. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard: http://localhost:3000

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/predict` | Score a transaction for fraud risk |
| POST | `/explain` | Generate SHAP-based model explanation |
| GET | `/transactions` | List all transactions with risk predictions |
| GET | `/transactions/{id}` | Get single transaction with prediction |
| GET | `/dashboard/stats` | Aggregated dashboard statistics |
| POST | `/analyst/review` | Record analyst review start |
| POST | `/analyst/decision` | Record final analyst decision |
| GET | `/analyst/reviews` | List analyst reviews |
| GET | `/audit/logs` | List audit log entries |

## Real-Time Test Flow

### Via API

```bash
# 1. Check health
curl http://localhost:8000/health

# 2. Submit a transaction for analysis
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "TXN_TEST_001",
    "age": 35,
    "gender": "M",
    "merchant_category": "electronics",
    "amount": 1250.00,
    "transaction_type": "Wire_Transfer",
    "card_type": "Credit",
    "card_present": 0,
    "device_type": "Web_Browser",
    "distance_from_home": 140.5,
    "distance_from_last_transaction": 80.0,
    "high_risk_country": 1,
    "velocity_last_24h": 6
  }'

# 3. Verify it's stored in the database
curl http://localhost:8000/transactions

# 4. View dashboard stats
curl http://localhost:8000/dashboard/stats
```

### Via React Dashboard

1. Open http://localhost:3000
2. Click **Analyze** in the sidebar
3. Fill in transaction details and click **Analyze Transaction**
4. View the ML prediction result (fraud probability, risk score, risk level)
5. Navigate to **Dashboard** to see real aggregated stats from the database
6. Navigate to **Transactions** to see all stored transactions

## Dashboard Pages

- **Dashboard** — Real-time stats from `GET /dashboard/stats`: total transactions, flagged count, risk level distribution, category risk, daily trends, recent flagged transactions
- **Transactions** — Full list from `GET /transactions` with search, risk level filter, and link to detail
- **Transaction Detail** — Individual transaction with fraud probability, risk score, risk factors, SHAP model explanation, analyst review form
- **Analyze** — Submit new transactions to the ML model for real-time fraud risk assessment

## Configuration

### Risk Thresholds (src/config.py)

```python
RISK_THRESHOLD_MEDIUM = 0.35   # P(fraud) >= this → MEDIUM
RISK_THRESHOLD_HIGH   = 0.70   # P(fraud) >= this → HIGH
```

### Model Version

```bash
export MODEL_VERSION="1.0.0"
```

## Project Structure

```
AI-Risk-Manager/
├── api/
│   ├── main.py              # FastAPI app, CORS, lifespan
│   └── routes.py            # All API endpoints
├── src/
│   ├── config.py            # Configuration, thresholds, paths
│   ├── database.py          # PostgreSQL/SQLite engine, sessions
│   ├── models_db.py         # SQLAlchemy ORM models
│   ├── data_loader.py       # CSV loading, validation
│   ├── feature_engineering.py # Temporal + domain features
│   ├── model_training.py    # RandomForest training
│   ├── model_inference.py   # FraudPredictor class
│   ├── risk_scoring.py      # Probability → score → level
│   ├── explainability.py    # SHAP explanations
│   ├── anomaly_detection.py # IsolationForest
│   ├── audit.py             # Audit logging
│   └── retraining.py        # Controlled retraining
├── frontend/
│   ├── src/
│   │   ├── pages/           # Dashboard, Transactions, Analyze
│   │   ├── services/api.ts  # Real API client
│   │   └── components/      # Reusable UI components
│   └── vite.config.ts       # Dev server + API proxy
├── data/
│   ├── raw/                 # Source CSV data
│   └── knowledge_base/      # RAG documents
├── models/                  # Trained model artifacts
├── tests/                   # pytest test suite
└── requirements.txt
```

## Testing

```bash
# Run all tests
python -m pytest tests/ -v

# Run specific test file
python -m pytest tests/test_api.py -v
```

## Tech Stack

- **Backend**: Python, FastAPI, SQLAlchemy, scikit-learn, SHAP
- **Frontend**: React 19, TypeScript, Vite, Recharts, React Router
- **Database**: PostgreSQL (production) / SQLite (local dev fallback)
- **ML**: RandomForestClassifier (150 trees, max_depth=14), IsolationForest anomaly detector
