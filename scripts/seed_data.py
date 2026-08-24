"""
Seed script: populates the SQLite database with sample transactions and risk predictions
so the dashboard has realistic data to display.

Usage:  python scripts/seed_data.py
"""

import json
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Ensure the project root is on sys.path so imports work
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from src.models_db import Base, Transaction, RiskPrediction, AnalystReview, AuditLog

DB_PATH = ROOT / "data" / "ai_risk_manager.db"
DB_URL = f"sqlite:///{DB_PATH}"

CATEGORIES = [
    "electronics", "groceries", "restaurants", "travel", "entertainment",
    "healthcare", "utilities", "clothing", "automotive", "jewelry",
]

TXN_TYPES = ["POS", "Online", "Wire_Transfer", "ATM_Withdrawal", "Contactless"]
CARD_TYPES = ["Credit", "Debit", "Prepaid"]
DEVICE_TYPES = ["Mobile_App", "Web_Browser", "POS_Terminal", "ATM", "Contactless"]
GENDERS = ["M", "F"]

RISK_FACTORS = [
    "high_amount_for_category",
    "unusual_time_of_day",
    "high_velocity",
    "distance_anomaly",
    "high_risk_country",
    "new_device",
    "card_not_present_high_amount",
    "multiple_failures",
]

MODEL_VERSION = "v1.0-seed"

random.seed(42)


def random_txn_id(i: int) -> str:
    return f"TXN_{i:05d}"


def random_customer_id(i: int) -> str:
    return f"CUST_{random.randint(1, 80):03d}"


def make_timestamp(base: datetime, offset_hours: int) -> str:
    ts = base - timedelta(hours=offset_hours)
    return ts.strftime("%Y-%m-%d %H:%M:%S")


def create_seed_data(session: Session, count: int = 50) -> None:
    base_time = datetime.now(timezone.utc)

    print(f"Seeding {count} transactions...")

    for i in range(1, count + 1):
        txn_id = random_txn_id(i)
        cust_id = random_customer_id(i)
        hours_ago = random.randint(0, 168)  # up to 7 days
        timestamp = make_timestamp(base_time, hours_ago)

        amount = round(random.uniform(5, 5000), 2)
        if random.random() < 0.15:
            amount = round(random.uniform(3000, 15000), 2)

        age = random.randint(18, 75)
        gender = random.choice(GENDERS)
        category = random.choice(CATEGORIES)
        txn_type = random.choice(TXN_TYPES)
        card_type = random.choice(CARD_TYPES)
        card_present = random.choice([0, 1])
        device = random.choice(DEVICE_TYPES)
        dist_home = round(random.uniform(0, 500), 1)
        dist_last = round(random.uniform(0, 200), 1)
        high_risk = random.choice([0, 0, 0, 1])
        velocity = random.randint(0, 15)

        txn = Transaction(
            transaction_id=txn_id,
            customer_id=cust_id,
            merchant_id=f"MERCH_{random.randint(1, 200):03d}",
            timestamp=timestamp,
            age=age,
            gender=gender,
            merchant_category=category,
            amount=amount,
            transaction_type=txn_type,
            card_type=card_type,
            card_present=card_present,
            device_type=device,
            distance_from_home=dist_home,
            distance_from_last_transaction=dist_last,
            high_risk_country=high_risk,
            velocity_last_24h=velocity,
        )
        session.add(txn)

        # Simulate risk score based on heuristics
        risk_score = 0
        risk_score += min(amount / 100, 30)
        risk_score += min(velocity * 3, 30)
        risk_score += 15 if high_risk else 0
        risk_score += min(dist_home / 20, 15)
        risk_score += 10 if card_present == 0 and amount > 500 else 0
        risk_score = min(int(risk_score + random.randint(-10, 10)), 100)
        risk_score = max(risk_score, 5)

        if risk_score >= 70:
            risk_level = "HIGH"
            decision = "DECLINE"
            fraud_prob = round(random.uniform(0.7, 0.99), 4)
        elif risk_score >= 40:
            risk_level = "MEDIUM"
            decision = "REVIEW"
            fraud_prob = round(random.uniform(0.3, 0.7), 4)
        else:
            risk_level = "LOW"
            decision = "APPROVE"
            fraud_prob = round(random.uniform(0.01, 0.3), 4)

        factors = random.sample(RISK_FACTORS, k=random.randint(1, 4))

        pred = RiskPrediction(
            transaction_id=txn_id,
            fraud_probability=fraud_prob,
            risk_score=risk_score,
            risk_level=risk_level,
            prediction=decision,
            triggered_risk_factors=json.dumps(factors),
            model_version=MODEL_VERSION,
            created_at=datetime.now(timezone.utc) - timedelta(hours=hours_ago),
        )
        session.add(pred)

        # Add analyst reviews for some flagged transactions
        if risk_level in ("HIGH", "MEDIUM") and random.random() < 0.5:
            decisions = ["CONFIRM_FRAUD", "FALSE_POSITIVE", "ESCALATE"]
            ad = random.choice(decisions)
            review = AnalystReview(
                transaction_id=txn_id,
                analyst_id="analyst-demo",
                decision=ad,
                notes=f"Reviewed transaction {txn_id}. {ad.replace('_', ' ').title()}.",
                ai_fraud_probability=fraud_prob,
                ai_risk_score=risk_score,
                ai_risk_level=risk_level,
                ai_decision=decision,
                model_version=MODEL_VERSION,
                created_at=datetime.now(timezone.utc) - timedelta(hours=max(hours_ago - 1, 0)),
            )
            session.add(review)

    # Add some audit log entries
    for i in range(1, min(count + 1, 20)):
        txn_id = random_txn_id(i)
        log = AuditLog(
            event_type="prediction_generated",
            transaction_id=txn_id,
            actor="system",
            timestamp=datetime.now(timezone.utc) - timedelta(hours=random.randint(0, 168)),
            details=json.dumps({"seed": True}),
            model_version=MODEL_VERSION,
        )
        session.add(log)

    session.commit()
    print(f"Done. Seeded {count} transactions, predictions, and audit logs.")


def main():
    if not DB_PATH.exists():
        print(f"Creating database at {DB_PATH}")
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    engine = create_engine(f"sqlite:///{DB_PATH}", echo=False)

    # Create tables if they don't exist
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        # Check if data already exists
        existing = session.query(Transaction).count()
        if existing > 0:
            print(f"Database already has {existing} transactions. Clearing and re-seeding...")
            session.query(AuditLog).delete()
            session.query(AnalystReview).delete()
            session.query(RiskPrediction).delete()
            session.query(Transaction).delete()
            session.commit()

        create_seed_data(session, count=60)

    print(f"\nDatabase ready at: {DB_PATH}")
    print("Start the API with: python -m uvicorn api.main:app --reload --port 8000")
    print("Start the frontend with: cd frontend && npm run dev")


if __name__ == "__main__":
    main()
