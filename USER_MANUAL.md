# AI Risk Manager - User Manual

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technologies & Libraries](#2-technologies--libraries)
3. [System Architecture](#3-system-architecture)
4. [Project Structure](#4-project-structure)
5. [Installation & Setup](#5-installation--setup)
6. [Algorithms & Models](#6-algorithms--models)
7. [How It Works - End-to-End Flow](#7-how-it-works---end-to-end-flow)
8. [API Endpoints Reference](#8-api-endpoints-reference)
9. [Frontend Dashboard Guide](#9-frontend-dashboard-guide)
10. [Database Schema](#10-database-schema)
11. [Configuration](#11-configuration)
12. [Testing](#12-testing)
13. [Deployment](#13-deployment)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Project Overview

**AI Risk Manager** is a full-stack, real-time financial fraud detection system. It combines:

- **Machine Learning** (supervised classification + unsupervised anomaly detection) to score transactions
- **REST API** built with FastAPI for the backend
- **React Dashboard** for monitoring, reviewing, and managing fraud alerts
- **RAG Knowledge Base** (Retrieval-Augmented Generation) for policy/procedure Q&A
- **Analyst Workflow** with audit logging, model monitoring, and controlled retraining

The system processes financial transactions, assigns risk scores (0-100), classifies them as LOW/MEDIUM/HIGH risk, and recommends actions (APPROVE/REVIEW/DECLINE). Human analysts can review flagged transactions, confirm or reject predictions, and feed confirmed labels back into the model for continuous improvement.

---

## 2. Technologies & Libraries

### Backend (Python)

| Category | Library | Purpose |
|---|---|---|
| Web Framework | **FastAPI** | REST API server |
| ASGI Server | **Uvicorn** | Runs the FastAPI app |
| ORM | **SQLAlchemy** | Database abstraction layer |
| Database | **psycopg2-binary** (PostgreSQL), **SQLite** (fallback) | Data persistence |
| ML/Data Science | **scikit-learn** | RandomForestClassifier, IsolationForest, LOF, DBSCAN, preprocessing |
| Data Processing | **pandas**, **numpy** | Data manipulation and numerical operations |
| Explainability | **SHAP** (optional) | Per-prediction feature attribution |
| Visualization | **matplotlib**, **seaborn** | Charts and plots (notebooks) |
| Serialization | **joblib** | Model artifact save/load |
| Authentication | **passlib** (bcrypt), **python-jose** (JWT) | User auth & JWT tokens |
| PDF Generation | **reportlab** | PDF report creation |
| Validation | **Pydantic** | Request/response schema validation |
| Environment | **python-dotenv** | Environment variable loading |
| Testing | **pytest** | Test framework |

### Frontend (TypeScript/React)

| Category | Library | Purpose |
|---|---|---|
| Framework | **React 19** | UI framework |
| Build Tool | **Vite 8** | Dev server + bundler |
| Language | **TypeScript 6** | Type-safe JavaScript |
| Routing | **react-router-dom 7** | Client-side routing |
| Styling | **Tailwind CSS 4** | Utility-first CSS framework |
| Charts | **Recharts 3** | Data visualization |
| Icons | **lucide-react** | Icon library |
| Date Utils | **date-fns 4** | Date formatting |
| CSV Parsing | **papaparse 5** | CSV upload parsing |

### RAG (Retrieval-Augmented Generation) - Optional

| Category | Library | Purpose |
|---|---|---|
| Embeddings | **sentence-transformers** (all-MiniLM-L6-v2) | 384-dim text embeddings |
| Vector Store | **ChromaDB** | Persistent cosine-distance vector search |
| LLM | **OpenAI API** (gpt-4o-mini) | Text generation for Q&A |

### DevOps

| Category | Tool | Purpose |
|---|---|---|
| Containerization | **Docker** | Production container (Python 3.11 + Node.js 20) |
| Cloud | **Render.com** | Deployment platform |

---

## 3. System Architecture

```
                    +-------------------+
                    |   React Frontend  |
                    |   (Port 3000)     |
                    +--------+----------+
                             |
                             | HTTP (Vite proxy)
                             v
                    +--------+----------+
                    |   FastAPI Backend  |
                    |   (Port 8000)     |
                    +--------+----------+
                             |
              +--------------+--------------+
              |              |              |
              v              v              v
     +--------+---+  +------+-----+  +-----+--------+
     | ML Models  |  | Database   |  | RAG System   |
     | RF + IF    |  | PG/SQLite  |  | ChromaDB     |
     +------------+  +------------+  +--------------+
```

### Request Flow
1. User interacts with the React Dashboard
2. Dashboard sends HTTP requests to FastAPI backend
3. Backend runs ML inference (RandomForest + IsolationForest)
4. Results stored in database (PostgreSQL or SQLite)
5. Analyst reviews flagged transactions
6. Confirmed labels feed back into retraining pipeline

---

## 4. Project Structure

```
AI-Risk-Manager/
|
+-- api/                          # FastAPI Backend
|   +-- main.py                   # App entry point, CORS, SPA serving
|   +-- routes.py                 # Core: predict, explain, transactions, dashboard
|   +-- routes_ai_models.py       # AI model management endpoints
|   +-- routes_alerts.py          # Alert CRUD endpoints
|   +-- routes_auth.py            # JWT authentication (register, login, me)
|   +-- routes_reports.py         # PDF/CSV report generation
|   +-- routes_upload.py          # CSV batch upload + analysis
|
+-- src/                          # Core ML/Python Modules
|   +-- config.py                 # All configuration & hyperparameters
|   +-- database.py               # SQLAlchemy engine/session
|   +-- models_db.py              # ORM models (7 tables)
|   +-- data_loader.py            # CSV loading, schema validation
|   +-- feature_engineering.py    # Feature extraction pipeline
|   +-- model_training.py         # RandomForest training
|   +-- model_inference.py        # FraudPredictor (production inference)
|   +-- risk_scoring.py           # Probability -> risk score -> decision
|   +-- explainability.py         # SHAP explanations
|   +-- anomaly_detection.py      # IsolationForest detector
|   +-- ensemble_detection.py     # IF + LOF + DBSCAN ensemble
|   +-- model_monitoring.py       # Drift detection (PSI, KS-test)
|   +-- retraining.py             # Controlled retraining pipeline
|   +-- audit.py                  # Audit logging
|   +-- utils.py                  # Logging, serialization helpers
|
+-- rag/                          # RAG Knowledge Base
|   +-- document_loader.py        # Load MD/TXT/CSV docs
|   +-- chunking.py               # Text chunking with overlap
|   +-- embeddings.py             # sentence-transformers or OpenAI
|   +-- vector_store.py           # ChromaDB vector store
|   +-- retriever.py              # Similarity search
|   +-- rag_pipeline.py           # End-to-end: retrieve -> generate
|
+-- frontend/                     # React SPA
|   +-- src/
|       +-- App.tsx               # Route definitions
|       +-- services/api.ts       # API client
|       +-- types/index.ts        # TypeScript interfaces
|       +-- contexts/             # AppContext, ThemeContext
|       +-- components/           # Layout, Sidebar, TopNavbar
|       +-- pages/                # 9 pages (Dashboard, Transactions, etc.)
|
+-- scripts/                      # Utility Scripts
|   +-- seed_data.py              # Populate DB with sample data
|   +-- train_anomaly_detector.py # Train IsolationForest
|   +-- run_monitoring.py         # Run model monitoring
|   +-- retrain_model.py          # Controlled retraining
|   +-- validate_kb.py            # Validate knowledge base
|
+-- tests/                        # pytest Test Suite (18 files)
+-- data/
|   +-- raw/                      # Raw training CSV
|   +-- processed/                # Preprocessed train/test splits
|   +-- knowledge_base/           # RAG documents (MD files)
|
+-- models/                       # Trained Model Artifacts
|   +-- risk_model.pkl            # Trained RandomForestClassifier
|   +-- preprocessor.joblib       # Fitted preprocessing pipeline
|   +-- anomaly_detector.joblib   # Fitted IsolationForest
|   +-- model_metrics.json        # Training/test metrics
|   +-- feature_importances.json  # Top 30 feature importances
|
+-- requirements.txt              # Core Python dependencies
+-- requirements-optional.txt     # Optional ML dependencies
+-- Dockerfile                    # Production container
+-- render.yaml                   # Render.com deployment
+-- .env.example                  # Environment template
```

---

## 5. Installation & Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- PostgreSQL (optional, SQLite works as fallback)

### Backend Setup

```bash
# 1. Clone the repository
git clone <repository-url>
cd AI-Risk-Manager

# 2. Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate    # Linux/Mac

# 3. Install dependencies
pip install -r requirements.txt

# 4. (Optional) Install optional ML dependencies
pip install -r requirements-optional.txt

# 5. Set up environment variables
copy .env.example .env
# Edit .env with your PostgreSQL credentials (or skip for SQLite)

# 6. Preprocess data and train models
python src/feature_engineering.py
python src/model_training.py

# 7. Seed sample data
python scripts/seed_data.py

# 8. Start the backend
uvicorn api.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend Setup

```bash
# 1. Navigate to frontend
cd frontend

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

The frontend runs on `http://localhost:3000` and proxies API requests to `http://localhost:8000`.

### Docker Setup

```bash
docker build -t ai-risk-manager .
docker run -p 8000:8000 ai-risk-manager
```

---

## 6. Algorithms & Models

### 6.1 Supervised Fraud Classification - RandomForest

**Algorithm**: `RandomForestClassifier` (scikit-learn)

| Parameter | Value |
|---|---|
| n_estimators | 150 |
| max_depth | 14 |
| min_samples_split | 5 |
| min_samples_leaf | 2 |
| class_weight | balanced_subsample |
| random_state | 42 |

**Performance**:
- Accuracy: 99.95%
- Precision: 100%
- Recall: 98.68%
- F1-Score: 99.34%
- ROC-AUC: 99.999%

**How it works**: The RandomForest builds 150 decision trees, each trained on a random subset of data and features. For a new transaction, all 150 trees vote on fraud probability. The average probability is used for risk scoring.

### 6.2 Feature Engineering Pipeline

A 3-stage sklearn `Pipeline` transforms raw transaction data:

**Stage 1 - TemporalFeatureExtractor**:
- Extracts hour, day_of_week from timestamp
- Computes is_weekend, is_night, is_business_hours
- Creates cyclical sin/cos encodings for hour and day

**Stage 2 - DomainFeatureExtractor**:
- log_amount (log-transformed amount)
- is_high_amount (above learned quantile threshold)
- is_round_amount (amount is a round number)
- amount_cents (decimal portion of amount)
- amount_to_age_ratio (amount / account age)
- is_high_velocity (transactions per 24h above threshold)
- amount_velocity_ratio, amount_x_velocity
- distance_total, distance_ratio
- is_far_from_home
- is_high_risk_channel
- composite_risk_flag

**Stage 3 - ColumnTransformer**:
- RobustScaler for continuous features
- SimpleImputer for flag columns
- OneHotEncoder for categorical features

### 6.3 Risk Scoring

Converts model output to actionable decisions:

```
P(fraud) [0.0 - 1.0]
    |
    v
Risk Score [0 - 100] = P(fraud) * 100
    |
    v
Risk Level:
  - LOW     : score < 35  -> Decision: APPROVE
  - MEDIUM  : 35 <= score < 70 -> Decision: REVIEW
  - HIGH    : score >= 70 -> Decision: DECLINE
```

### 6.4 Unsupervised Anomaly Detection - IsolationForest

**Algorithm**: `IsolationForest` (scikit-learn)

| Parameter | Value |
|---|---|
| contamination | 0.05 |
| n_estimators | 100 |

**How it works**: IsolationForest isolates anomalies by randomly selecting features and split values. Anomalies are isolated in fewer splits (shorter path lengths). The raw score [-1, +1] is normalized to [0, 1] where 1 = most anomalous.

### 6.5 Ensemble Anomaly Detection

Combines three algorithms with weighted voting:

| Algorithm | Weight |
|---|---|
| IsolationForest | 0.5 |
| Local Outlier Factor (LOF) | 0.3 |
| DBSCAN clustering | 0.2 |

- IsolationForest: Isolates anomalies via random partitions
- LOF: Compares local density of a point to its neighbors
- DBSCAN: Density-based clustering, points not in any cluster are anomalies

**Decision**: If ensemble score > 0.8, the transaction is flagged as anomalous even if no single model flagged it.

### 6.6 Model Explainability - SHAP

**Algorithm**: `SHAP TreeExplainer`

For each prediction, SHAP computes:
- Which features contributed most to the fraud score
- Direction: does the feature increase or decrease risk?
- Magnitude: how much does each feature contribute?

Example output:
```
distance_total: +25.3 (increases risk)
amount_x_velocity: +18.7 (increases risk)
card_present: -12.1 (decreases risk)
```

Falls back to global feature importances when SHAP is unavailable.

### 6.7 Model Monitoring - Drift Detection

| Method | What it Measures |
|---|---|
| **PSI** (Population Stability Index) | Shift in prediction distribution over time |
| **KS-test** (Kolmogorov-Smirnov) | Feature distribution changes vs. training baseline |
| **Performance Metrics** | Precision/Recall/F1 degradation vs. reference thresholds |
| **Risk Level Distribution** | Shift in HIGH/MEDIUM/LOW risk proportions |

Severity levels: OK, WARNING, ALERT

### 6.8 Controlled Retraining

Human-in-the-loop retraining pipeline:

1. Collects confirmed analyst labels (CONFIRM_FRAUD / FALSE_POSITIVE)
2. Combines original training data + new confirmed labels
3. Trains candidate RandomForest model
4. Evaluates on held-out test set
5. Compares against current production model
6. **Never auto-replaces** - saves to versioned directory
7. Human reviews report and promotes with `--promote <version>`

**Promotion gates**:
- Minimum 50 labeled samples
- Minimum 10 fraud cases
- F1 improvement above threshold

### 6.9 RAG Knowledge Base

Retrieval-Augmented Generation for policy/procedure Q&A:

1. **Document Loading**: Loads Markdown/TXT/CSV from knowledge_base/
2. **Chunking**: Splits documents into overlapping chunks (character or token-based)
3. **Embeddings**: Converts text to vectors (sentence-transformers or OpenAI)
4. **Vector Store**: ChromaDB with cosine similarity search
5. **Retrieval**: Finds most relevant chunks for a query
6. **Generation**: OpenAI gpt-4o-mini generates answers with citations
7. **Confidence Scoring**: Based on retrieval score and coverage

**Note**: RAG is strictly for policy/procedure Q&A, never for transaction fraud decisions.

---

## 7. How It Works - End-to-End Flow

### 7.1 Data Pipeline

```
Raw CSV (data/raw/fraud_transactions.csv)
    |
    v
data_loader.py - Load, validate schema, clean duplicates
    |
    v
feature_engineering.py - Stratified split, fit pipeline, transform
    |
    v
Processed CSVs (data/processed/) + Preprocessor artifact (models/)
```

### 7.2 Training Pipeline

```
Processed Data
    |
    v
model_training.py
    +-- Train RandomForest (150 trees, max_depth=14)
    +-- Train IsolationForest (contamination=0.05)
    +-- Evaluate (accuracy, precision, recall, F1, ROC-AUC)
    +-- Save artifacts:
        - models/risk_model.pkl
        - models/preprocessor.joblib
        - models/anomaly_detector.joblib
        - models/model_metrics.json
        - models/feature_importances.json
```

### 7.3 Inference Pipeline (Per Transaction)

```
Transaction arrives via POST /predict
    |
    v
1. Audit log: transaction_received
    |
    v
2. FraudPredictor.score_transaction():
    a. Preprocess through fitted pipeline
    b. RandomForest predict_proba -> P(fraud)
    c. compute_risk_score(): probability -> score (0-100) -> level
    d. Determine decision: APPROVE/REVIEW/DECLINE
    e. _identify_triggered_rules(): rule-based risk factors
    |
    v
3. Optional: IsolationForest anomaly detection
    |
    v
4. Persist Transaction + RiskPrediction to database
    |
    v
5. Audit log: prediction_generated, risk_score_generated
    |
    v
6. Return structured JSON response
```

### 7.4 Analyst Workflow

```
HIGH/MEDIUM risk transaction flagged
    |
    v
Analyst reviews via POST /analyst/review
    |
    v
Analyst submits decision via POST /analyst/decision
    +-- CONFIRM_FRAUD: AI was correct
    +-- FALSE_POSITIVE: AI was wrong
    +-- ESCALATE: Needs supervisor review
    |
    v
Decision persisted to analyst_reviews table
    |
    v
Confirmed labels feed into retraining pipeline
```

### 7.5 Monitoring & Retraining

```
scripts/run_monitoring.py
    +-- Collect production data
    +-- Compare against reference baseline
    +-- Generate drift report (PSI, KS-test, metrics)
    +-- Output: reports/monitoring/*.json

scripts/retrain_model.py
    +-- Collect confirmed analyst labels
    +-- Build candidate training dataset
    +-- Train candidate model
    +-- Evaluate vs. production model
    +-- Save versioned candidate

scripts/retrain_model.py --promote <version>
    +-- Human reviews comparison report
    +-- Promotes candidate to production
```

---

## 8. API Endpoints Reference

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register new user account + get JWT token |
| POST | `/auth/login` | Sign in with email and password + get JWT token |
| GET | `/auth/me` | Get current authenticated user |

### Core Prediction

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/predict` | Score a transaction for fraud risk |
| POST | `/explain` | Get SHAP-based model explanation |
| GET | `/transactions` | List all transactions with risk predictions |
| GET | `/transactions/{id}` | Get single transaction detail |
| GET | `/dashboard/stats` | Aggregated dashboard statistics |

### Analyst Workflow

| Method | Endpoint | Description |
|---|---|---|
| POST | `/analyst/review` | Record analyst review start |
| POST | `/analyst/decision` | Record final analyst decision |
| GET | `/analyst/reviews` | List analyst reviews |

### Alert Management

| Method | Endpoint | Description |
|---|---|---|
| GET | `/alerts` | List alerts with filtering |
| GET | `/alerts/stats` | Aggregated alert statistics |
| PUT | `/alerts/{id}` | Update alert status |

### Report Generation

| Method | Endpoint | Description |
|---|---|---|
| GET | `/reports/summary` | Report summary statistics |
| GET | `/reports/export/csv` | Export flagged transactions as CSV |
| GET | `/reports/export/pdf` | Generate PDF report |

### Upload / Batch Processing

| Method | Endpoint | Description |
|---|---|---|
| POST | `/upload/preview` | Preview CSV before analysis |
| POST | `/upload/csv` | Upload CSV and run batch fraud analysis |
| POST | `/thresholds` | Reclassify all transactions with new thresholds |

### AI Model Management

| Method | Endpoint | Description |
|---|---|---|
| GET | `/ai-models` | List registered AI models |
| GET | `/ai-models/performance` | Model accuracy over time |
| GET/POST | `/ai-models/thresholds` | Get/update risk thresholds |
| POST | `/ai-models/{id}/toggle` | Toggle model active/inactive |

---

## 9. Frontend Dashboard Guide

### Pages

| Page | Route | Description |
|---|---|---|
| Landing | `/` | Marketing/landing page |
| Login | `/login` | Email + password authentication |
| Signup | `/register` | User registration & direct sign-in |
| Dashboard | `/dashboard` | Real-time stats, charts, alerts |
| Transactions | `/transactions` | Full transaction list with search/filter |
| Alerts | `/alerts` | Alert management with status updates |
| AI Models | `/ai-models` | Model performance, threshold config |
| Reports | `/reports` | Report generation, CSV/PDF export |
| Audit Log | `/audit` | System audit trail viewer |
| Settings | `/settings` | User settings |

### Dashboard Features
- **Animated count-up statistics**: Total transactions, fraud detected, accuracy, alerts
- **Recharts area charts**: Risk trends over time
- **Pie charts**: Risk level distribution (LOW/MEDIUM/HIGH)
- **Recent alerts table**: Latest flagged transactions
- **Real-time data**: Fetched from API (not mock data in production)

### Transaction Management
- Search by transaction ID, card number, or merchant
- Filter by risk level, status, date range
- Click transaction to see full details + AI explanation
- CSV upload for batch analysis

### Reports
- Generate summary reports
- Export flagged transactions as CSV
- Download PDF reports with charts and tables

---

## 10. Database Schema

### Database Engine
- **Production**: PostgreSQL via SQLAlchemy
- **Development/Fallback**: SQLite at `data/ai_risk_manager.db`
- SQLite runs in WAL mode for better concurrency

### Tables (6 ORM Models)

| Table | Model | Purpose |
|---|---|---|
| `transactions` | Transaction | Raw transaction data from API |
| `risk_predictions` | RiskPrediction | ML output: probability, score, level, decision |
| `analyst_reviews` | AnalystReview | Human decisions with AI prediction context |
| `audit_logs` | AuditLog | Immutable audit trail of all actions |
| `alerts` | Alert | Auto-generated alerts for HIGH/MEDIUM risk |
| `users` | User | User accounts with roles (Admin/Analyst/Viewer) |

---

## 11. Configuration

### Central Configuration (`src/config.py`)

All paths, hyperparameters, thresholds, and environment variables are defined in `src/config.py`.

### Key Configuration Values

| Setting | Default | Description |
|---|---|---|
| `RANDOM_STATE` | 42 | Reproducibility seed |
| `N_ESTIMATORS` | 150 | Number of trees in RandomForest |
| `MAX_DEPTH` | 14 | Maximum tree depth |
| `TEST_SIZE` | 0.2 | Train/test split ratio |
| `ANOMALY_CONTAMINATION` | 0.05 | Expected fraud rate for IsolationForest |
| `RISK_MEDIUM_THRESHOLD` | 0.35 | P(fraud) threshold for MEDIUM risk |
| `RISK_HIGH_THRESHOLD` | 0.70 | P(fraud) threshold for HIGH risk |
| `DATABASE_URL` | env var | PostgreSQL connection string |
| `SECRET_KEY` | env var | JWT signing key |

### Environment Variables (`.env`)

```env
DATABASE_URL=postgresql://user:password@localhost:5432/ai_risk_manager
SECRET_KEY=your-secret-key-here
OPENAI_API_KEY=sk-...         # Optional, for RAG
```

---

## 12. Testing

### Run All Tests

```bash
python -m pytest tests/ -v
```

### Test Coverage (18 test files)

| Test File | What it Tests |
|---|---|
| `test_api.py` | API endpoint functionality |
| `test_data.py` | Data loading and validation |
| `test_data_loading.py` | CSV loading edge cases |
| `test_data_preprocessing.py` | Data cleaning |
| `test_feature_engineering.py` | Feature extraction pipeline |
| `test_model.py` | Model training |
| `test_ml_inference.py` | ML inference pipeline |
| `test_risk_scoring.py` | Risk score calculation |
| `test_risk_scoring_new.py` | Updated risk scoring |
| `test_anomaly_detection.py` | IsolationForest detection |
| `test_explainability.py` | SHAP explanations |
| `test_database.py` | Database operations |
| `test_audit_logging.py` | Audit trail |
| `test_analyst_review.py` | Analyst workflow |
| `test_invalid_api_input.py` | Input validation |
| `test_vector_search.py` | Vector store search |
| `test_rag_retrieval.py` | RAG retrieval |

### Test Infrastructure
- In-memory SQLite databases (no external dependencies)
- Synthetic deterministic data (200 transactions, 30 fraud cases)
- Mock model artifacts (small RandomForest with 10 trees)
- Temporary directories for all file I/O

---

## 13. Deployment

### Docker

```bash
# Build
docker build -t ai-risk-manager .

# Run
docker run -p 8000:8000 ai-risk-manager
```

The Dockerfile uses a multi-stage build:
1. Python 3.11-slim for backend
2. Node.js 20 for frontend build
3. Copies built frontend into Python container
4. Runs uvicorn on port 8000

### Render.com

The `render.yaml` defines:
- Docker-based web service
- Environment variable mapping (DATABASE_URL, SECRET_KEY)
- Automatic deployment on push

### Production Checklist

- [ ] Set `DATABASE_URL` to PostgreSQL instance
- [ ] Set `SECRET_KEY` to a strong random string
- [ ] Run preprocessing: `python src/feature_engineering.py`
- [ ] Train models: `python src/model_training.py`
- [ ] Seed data: `python scripts/seed_data.py`
- [ ] Optionally install RAG deps: `pip install -r requirements-optional.txt`
- [ ] Build frontend: `cd frontend && npm run build`

---

## 14. Troubleshooting

### Common Issues

| Issue | Solution |
|---|---|
| `ModuleNotFoundError: No module named 'sklearn'` | Run `pip install -r requirements.txt` |
| `sqlite3.OperationalError: database is locked` | WAL mode is enabled; ensure only one process writes at a time |
| `SHAP not available` | Install: `pip install shap` (optional) |
| `RAG pipeline not available` | Install: `pip install -r requirements-optional.txt` |
| Frontend can't reach API | Ensure backend is running on port 8000; Vite proxy is configured |
| `psycopg2` install fails | Use SQLite fallback (no PostgreSQL needed for dev) |
| Model metrics are low | Re-run training: `python src/model_training.py` |

### Useful Commands

```bash
# Check backend health
curl http://localhost:8000/health

# Run monitoring
python scripts/run_monitoring.py

# Retrain model
python scripts/retrain_model.py

# Promote a retrained model
python scripts/retrain_model.py --promote 1.1.0

# Validate knowledge base
python scripts/validate_kb.py

# Run full test suite
python -m pytest tests/ -v
```

---

## Key Design Principles

1. **Human-in-the-loop**: ML provides risk scores; humans make final decisions; confirmed labels feed back into retraining
2. **No auto-replacement**: Production model is never automatically replaced; retraining produces candidates that require human promotion
3. **Audit everything**: Every transaction, prediction, analyst action, and system event is logged to an immutable audit trail
4. **Graceful degradation**: Works with SQLite if PostgreSQL unavailable; works without SHAP if not installed; works without LLM if not configured
5. **Defense in depth**: Multiple detection layers (supervised RF + unsupervised IF + ensemble IF/LOF/DBSCAN)

---

*Generated for AI Risk Manager project*
