"""
Report generation endpoints for AI Risk Manager.

Generates PDF and CSV reports summarizing fraud analysis results.
"""

import csv
import io
import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func

from src.config import MODEL_VERSION
from src.database import get_db_session
from src.models_db import Alert, RiskPrediction, Transaction
from src.utils import logger

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ReportSummary(BaseModel):
    """Summary statistics for the report."""
    total_transactions: int
    total_flagged: int
    high_risk: int
    medium_risk: int
    low_risk: int
    avg_risk_score: float
    total_amount_analyzed: float
    total_amount_at_risk: float
    fraud_rate_pct: float
    top_riskiest_transactions: list
    category_breakdown: list


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/reports/summary",
    response_model=ReportSummary,
    summary="Get report summary statistics",
    tags=["Reports"],
)
def get_report_summary() -> ReportSummary:
    """Compute summary statistics for report generation."""
    try:
        with get_db_session() as session:
            total = session.query(func.count(Transaction.id)).scalar() or 0

            high = session.query(func.count(RiskPrediction.id)).filter(
                RiskPrediction.risk_level == "HIGH"
            ).scalar() or 0
            medium = session.query(func.count(RiskPrediction.id)).filter(
                RiskPrediction.risk_level == "MEDIUM"
            ).scalar() or 0
            low = session.query(func.count(RiskPrediction.id)).filter(
                RiskPrediction.risk_level == "LOW"
            ).scalar() or 0
            flagged = high + medium

            avg_score = session.query(func.avg(RiskPrediction.risk_score)).scalar()
            avg_score = round(float(avg_score), 1) if avg_score else 0.0

            total_amount = session.query(func.sum(Transaction.amount)).scalar()
            total_amount = round(float(total_amount), 2) if total_amount else 0.0

            # Amount at risk (HIGH + MEDIUM)
            amount_at_risk = (
                session.query(func.sum(Transaction.amount))
                .join(RiskPrediction, Transaction.transaction_id == RiskPrediction.transaction_id)
                .filter(RiskPrediction.risk_level.in_(["HIGH", "MEDIUM"]))
                .scalar()
            )
            amount_at_risk = round(float(amount_at_risk), 2) if amount_at_risk else 0.0

            fraud_rate = (flagged / total * 100) if total > 0 else 0.0

            # Top riskiest transactions
            top_risky = (
                session.query(Transaction, RiskPrediction)
                .join(RiskPrediction, Transaction.transaction_id == RiskPrediction.transaction_id)
                .order_by(RiskPrediction.risk_score.desc())
                .limit(10)
                .all()
            )
            top_list = []
            for txn, pred in top_risky:
                top_list.append({
                    "transaction_id": txn.transaction_id,
                    "amount": txn.amount,
                    "merchant_category": txn.merchant_category,
                    "risk_score": pred.risk_score,
                    "risk_level": pred.risk_level,
                    "fraud_probability": pred.fraud_probability,
                })

            # Category breakdown
            cat_results = (
                session.query(
                    Transaction.merchant_category,
                    func.count(RiskPrediction.id).label("count"),
                    func.avg(RiskPrediction.risk_score).label("avg_score"),
                    func.sum(Transaction.amount).label("total_amount"),
                )
                .join(RiskPrediction, Transaction.transaction_id == RiskPrediction.transaction_id)
                .filter(Transaction.merchant_category.isnot(None))
                .group_by(Transaction.merchant_category)
                .order_by(func.count(RiskPrediction.id).desc())
                .all()
            )
            category_breakdown = [
                {
                    "category": cat,
                    "count": count,
                    "avg_risk_score": round(float(score), 1) if score else 0,
                    "total_amount": round(float(amt), 2) if amt else 0,
                }
                for cat, count, score, amt in cat_results
            ]

            return ReportSummary(
                total_transactions=total,
                total_flagged=flagged,
                high_risk=high,
                medium_risk=medium,
                low_risk=low,
                avg_risk_score=avg_score,
                total_amount_analyzed=total_amount,
                total_amount_at_risk=amount_at_risk,
                fraud_rate_pct=round(fraud_rate, 2),
                top_riskiest_transactions=top_list,
                category_breakdown=category_breakdown,
            )

    except Exception as exc:
        logger.error(f"Failed to compute report summary: {exc}")
        raise HTTPException(status_code=500, detail="Failed to compute report summary")


@router.get(
    "/reports/export/csv",
    summary="Export flagged transactions as CSV",
    tags=["Reports"],
)
def export_flagged_csv(risk_level: Optional[str] = None) -> StreamingResponse:
    """Download flagged transactions as a CSV file.

    If risk_level is specified, only exports transactions at that level.
    Otherwise exports all HIGH and MEDIUM risk transactions.
    """
    try:
        with get_db_session() as session:
            query = (
                session.query(Transaction, RiskPrediction)
                .join(RiskPrediction, Transaction.transaction_id == RiskPrediction.transaction_id)
            )

            if risk_level:
                query = query.filter(RiskPrediction.risk_level == risk_level.upper())
            else:
                query = query.filter(RiskPrediction.risk_level.in_(["HIGH", "MEDIUM"]))

            rows = query.order_by(RiskPrediction.risk_score.desc()).all()

            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow([
                "Transaction ID", "Amount", "Merchant Category", "Transaction Type",
                "Card Type", "Device Type", "Risk Score", "Risk Level",
                "Fraud Probability", "Decision", "Risk Factors", "Created At",
            ])

            for txn, pred in rows:
                factors = ""
                if pred.triggered_risk_factors:
                    try:
                        factors = "; ".join(json.loads(pred.triggered_risk_factors))
                    except (json.JSONDecodeError, TypeError):
                        factors = pred.triggered_risk_factors

                writer.writerow([
                    txn.transaction_id,
                    txn.amount,
                    txn.merchant_category,
                    txn.transaction_type,
                    txn.card_type,
                    txn.device_type,
                    pred.risk_score,
                    pred.risk_level,
                    f"{pred.fraud_probability:.4f}",
                    pred.prediction,
                    factors,
                    txn.created_at.isoformat() if txn.created_at else "",
                ])

            output.seek(0)
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            filename = f"flagged_transactions_{timestamp}.csv"

            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="text/csv",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            )

    except Exception as exc:
        logger.error(f"Failed to export CSV: {exc}")
        raise HTTPException(status_code=500, detail="Failed to export CSV")


@router.get(
    "/reports/export/pdf",
    summary="Generate and download a PDF report",
    tags=["Reports"],
)
def export_pdf_report() -> StreamingResponse:
    """Generate a PDF report summarizing the fraud analysis results.

    Uses a lightweight HTML-to-PDF approach for simplicity.
    """
    try:
        with get_db_session() as session:
            # Gather stats
            total = session.query(func.count(Transaction.id)).scalar() or 0
            high = session.query(func.count(RiskPrediction.id)).filter(
                RiskPrediction.risk_level == "HIGH"
            ).scalar() or 0
            medium = session.query(func.count(RiskPrediction.id)).filter(
                RiskPrediction.risk_level == "MEDIUM"
            ).scalar() or 0
            low = session.query(func.count(RiskPrediction.id)).filter(
                RiskPrediction.risk_level == "LOW"
            ).scalar() or 0
            flagged = high + medium

            avg_score = session.query(func.avg(RiskPrediction.risk_score)).scalar()
            avg_score = round(float(avg_score), 1) if avg_score else 0.0

            total_amount = session.query(func.sum(Transaction.amount)).scalar()
            total_amount = round(float(total_amount), 2) if total_amount else 0.0

            amount_at_risk = (
                session.query(func.sum(Transaction.amount))
                .join(RiskPrediction, Transaction.transaction_id == RiskPrediction.transaction_id)
                .filter(RiskPrediction.risk_level.in_(["HIGH", "MEDIUM"]))
                .scalar()
            )
            amount_at_risk = round(float(amount_at_risk), 2) if amount_at_risk else 0.0

            fraud_rate = (flagged / total * 100) if total > 0 else 0.0

            # Top risky transactions
            top_risky = (
                session.query(Transaction, RiskPrediction)
                .join(RiskPrediction, Transaction.transaction_id == RiskPrediction.transaction_id)
                .order_by(RiskPrediction.risk_score.desc())
                .limit(20)
                .all()
            )

            # Build HTML report
            now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
            rows_html = ""
            for i, (txn, pred) in enumerate(top_risky, 1):
                factors = ""
                if pred.triggered_risk_factors:
                    try:
                        factors = "<br>".join(json.loads(pred.triggered_risk_factors))
                    except (json.JSONDecodeError, TypeError):
                        factors = pred.triggered_risk_factors

                risk_color = "#ef4444" if pred.risk_level == "HIGH" else "#f59e0b" if pred.risk_level == "MEDIUM" else "#10b981"
                rows_html += f"""
                <tr>
                    <td>{i}</td>
                    <td>{txn.transaction_id or 'N/A'}</td>
                    <td>${txn.amount:,.2f}</td>
                    <td>{txn.merchant_category or 'N/A'}</td>
                    <td style="color:{risk_color};font-weight:bold">{pred.risk_score}</td>
                    <td style="color:{risk_color};font-weight:bold">{pred.risk_level}</td>
                    <td>{pred.fraud_probability:.2%}</td>
                    <td style="font-size:10px">{factors}</td>
                </tr>
                """

            html = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{ font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; color: #1e293b; }}
                    h1 {{ color: #1e1b4b; border-bottom: 3px solid #6366f1; padding-bottom: 10px; }}
                    h2 {{ color: #374151; margin-top: 30px; }}
                    .meta {{ color: #6b7280; font-size: 12px; margin-bottom: 20px; }}
                    .stats-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }}
                    .stat-box {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center; }}
                    .stat-value {{ font-size: 28px; font-weight: 700; color: #1e1b4b; }}
                    .stat-label {{ font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }}
                    .stat-box.high {{ border-left: 4px solid #ef4444; }}
                    .stat-box.medium {{ border-left: 4px solid #f59e0b; }}
                    .stat-box.low {{ border-left: 4px solid #10b981; }}
                    table {{ width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }}
                    th {{ background: #1e1b4b; color: white; padding: 10px 8px; text-align: left; }}
                    td {{ padding: 8px; border-bottom: 1px solid #e2e8f0; }}
                    tr:nth-child(even) {{ background: #f8fafc; }}
                    .footer {{ margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #9ca3af; }}
                </style>
            </head>
            <body>
                <h1>AI Risk Manager - Fraud Analysis Report</h1>
                <p class="meta">Generated: {now} | Model Version: {MODEL_VERSION}</p>

                <h2>Executive Summary</h2>
                <div class="stats-grid">
                    <div class="stat-box">
                        <div class="stat-value">{total:,}</div>
                        <div class="stat-label">Total Transactions</div>
                    </div>
                    <div class="stat-box high">
                        <div class="stat-value">{flagged:,}</div>
                        <div class="stat-label">Flagged ({fraud_rate:.1f}%)</div>
                    </div>
                    <div class="stat-box medium">
                        <div class="stat-value">{avg_score}</div>
                        <div class="stat-label">Avg Risk Score</div>
                    </div>
                    <div class="stat-box low">
                        <div class="stat-value">${amount_at_risk:,.2f}</div>
                        <div class="stat-label">Amount at Risk</div>
                    </div>
                </div>

                <h2>Risk Level Distribution</h2>
                <table>
                    <tr><th>Level</th><th>Count</th><th>% of Total</th></tr>
                    <tr><td style="color:#ef4444;font-weight:bold">HIGH</td><td>{high:,}</td><td>{high/total*100:.1f}%</td></tr>
                    <tr><td style="color:#f59e0b;font-weight:bold">MEDIUM</td><td>{medium:,}</td><td>{medium/total*100:.1f}%</td></tr>
                    <tr><td style="color:#10b981;font-weight:bold">LOW</td><td>{low:,}</td><td>{low/total*100:.1f}%</td></tr>
                </table>

                <h2>Top 20 Riskiest Transactions</h2>
                <table>
                    <tr>
                        <th>#</th><th>Transaction ID</th><th>Amount</th><th>Category</th>
                        <th>Risk Score</th><th>Level</th><th>Probability</th><th>Reasons</th>
                    </tr>
                    {rows_html}
                </table>

                <div class="footer">
                    <p>This report was generated automatically by AI Risk Manager.</p>
                    <p>Total Amount Analyzed: ${total_amount:,.2f} | Fraud Rate: {fraud_rate:.2f}%</p>
                </div>
            </body>
            </html>
            """

            # Try to use a PDF library, fall back to HTML if not available
            try:
                from reportlab.lib.pagesizes import A4
                from reportlab.lib.styles import getSampleStyleSheet
                from reportlab.lib.units import inch
                from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
                from reportlab.lib import colors
                from reportlab.lib.styles import ParagraphStyle

                buffer = io.BytesIO()
                doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=40, bottomMargin=40)
                styles = getSampleStyleSheet()
                story = []

                # Title
                title_style = ParagraphStyle(
                    'CustomTitle', parent=styles['Title'],
                    fontSize=22, spaceAfter=20, textColor=colors.HexColor('#1e1b4b'),
                )
                story.append(Paragraph("AI Risk Manager - Fraud Analysis Report", title_style))
                story.append(Paragraph(f"Generated: {now} | Model Version: {MODEL_VERSION}", styles['Normal']))
                story.append(Spacer(1, 20))

                # Summary stats
                story.append(Paragraph("Executive Summary", styles['Heading2']))
                summary_data = [
                    ['Metric', 'Value'],
                    ['Total Transactions', f'{total:,}'],
                    ['Flagged Transactions', f'{flagged:,} ({fraud_rate:.1f}%)'],
                    ['Average Risk Score', f'{avg_score}'],
                    ['Total Amount Analyzed', f'${total_amount:,.2f}'],
                    ['Amount at Risk', f'${amount_at_risk:,.2f}'],
                ]
                t = Table(summary_data, colWidths=[3*inch, 3*inch])
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e1b4b')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
                ]))
                story.append(t)
                story.append(Spacer(1, 20))

                # Risk distribution
                story.append(Paragraph("Risk Level Distribution", styles['Heading2']))
                dist_data = [
                    ['Level', 'Count', '% of Total'],
                    ['HIGH', f'{high:,}', f'{high/total*100:.1f}%' if total else '0%'],
                    ['MEDIUM', f'{medium:,}', f'{medium/total*100:.1f}%' if total else '0%'],
                    ['LOW', f'{low:,}', f'{low/total*100:.1f}%' if total else '0%'],
                ]
                t2 = Table(dist_data, colWidths=[2*inch, 2*inch, 2*inch])
                t2.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e1b4b')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
                ]))
                story.append(t2)
                story.append(Spacer(1, 20))

                # Top risky transactions
                story.append(Paragraph("Top Riskiest Transactions", styles['Heading2']))
                risky_data = [['#', 'Txn ID', 'Amount', 'Category', 'Score', 'Level', 'Prob']]
                for i, (txn, pred) in enumerate(top_risky[:15], 1):
                    risky_data.append([
                        str(i),
                        str(txn.transaction_id or 'N/A')[:20],
                        f'${txn.amount:,.2f}',
                        str(txn.merchant_category or 'N/A')[:15],
                        str(pred.risk_score),
                        pred.risk_level,
                        f'{pred.fraud_probability:.2%}',
                    ])
                t3 = Table(risky_data, colWidths=[0.3*inch, 1.3*inch, 1*inch, 1*inch, 0.6*inch, 0.7*inch, 0.8*inch])
                t3.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e1b4b')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('FONTSIZE', (0, 0), (-1, -1), 8),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
                ]))
                story.append(t3)

                doc.build(story)
                buffer.seek(0)

                timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
                filename = f"ai_risk_report_{timestamp}.pdf"

                return StreamingResponse(
                    iter([buffer.getvalue()]),
                    media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'},
                )

            except ImportError:
                # reportlab not available — return HTML as a downloadable file
                logger.warning("reportlab not available, returning HTML report instead of PDF")
                timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
                filename = f"ai_risk_report_{timestamp}.html"
                return StreamingResponse(
                    iter([html]),
                    media_type="text/html",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'},
                )

    except Exception as exc:
        logger.error(f"Failed to generate PDF report: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {exc}")
