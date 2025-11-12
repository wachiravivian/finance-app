# app.py
from __future__ import annotations

import logging
import pathlib
import re
from typing import List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from dateutil import parser as dtparser
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="FinAccess API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten for prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

log = logging.getLogger("uvicorn.error")

# ---------- Load ML models ----------
BASE_DIR = pathlib.Path(__file__).resolve().parent
ART_DIR = BASE_DIR / "artifacts"
ART_DIR.mkdir(exist_ok=True)

rf_path = ART_DIR / "finaccess_rf.pkl"
km_path = ART_DIR / "kmeans_segments.pkl"
clf = joblib.load(rf_path) if rf_path.exists() else None
km = joblib.load(km_path) if km_path.exists() else None

# ---------- Health / Version ----------
@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/version")
def version():
    return {
        "api": app.version,
        "clf_loaded": clf is not None,
        "kmeans_loaded": km is not None,
    }

# ---------- ML Prediction Endpoint (Original) ----------
class Payload(BaseModel):
    Age: float | None = None
    Sex: str | None = None
    Education: str | None = None
    county: str | None = None
    CalcExpenditure: float | None = None
    tot_savings: float | None = None
    Classification_A_Liquidity: float | None = None
    mobile_money_use: int | None = None

@app.post("/predict")
def predict(p: Payload):
    if clf is None:
        raise HTTPException(status_code=500, detail="ML model not loaded")
    
    d = p.dict()
    eps = 1e-6
    d['exp_norm'] = np.log1p(d.get('CalcExpenditure') or 0.0)
    d['sav_norm'] = np.log1p(d.get('tot_savings') or 0.0)
    mx_liq = 4.0
    d['liquidity_ok'] = (d.get('Classification_A_Liquidity') or 0.0) / mx_liq
    
    row = pd.DataFrame([{
        'Age': d.get('Age'),
        'Sex': d.get('Sex'),
        'Education': d.get('Education'),
        'county': d.get('county'),
        'exp_norm': d.get('exp_norm'),
        'sav_norm': d.get('sav_norm'),
        'liquidity_ok': d.get('liquidity_ok'),
        'mobile_money_use': d.get('mobile_money_use'),
    }])
    
    fh_pred = clf.predict(row)[0]
    
    if km is not None:
        try:
            k_input = row[['liquidity_ok','exp_norm','sav_norm','Age','Sex','Education','county']]\
                .reindex(columns=['liquidity_ok','exp_norm','sav_norm','Age','Sex','Education','county'], fill_value=None)
            cluster = int(km.named_steps['km'].predict(km.named_steps['pre'].transform(k_input))[0])
        except Exception as e:
            log.warning(f"Cluster prediction failed: {e}")
            cluster = -1
    else:
        cluster = -1
    
    return {"financial_health": str(fh_pred), "cluster": cluster}

# ---------- M-PESA Parsing Helpers ----------
def parse_amount(x: Optional[str]) -> float:
    """Extract numeric amount from string."""
    if not x:
        return 0.0
    s = str(x).strip().replace(',', '')
    try:
        return abs(float(s))
    except Exception:
        return 0.0

def infer_type_cat(desc: str, direction: str) -> Tuple[str, str]:
    """Infer transaction type and category from description."""
    d = (desc or "").lower()
    
    if "pay bill" in d or "paybill" in d:
        tx = "paybill"
    elif "payment to small business" in d or "small business" in d:
        tx = "buygoods"
    elif "withdraw" in d or "agent till" in d:
        tx = "withdraw"
    elif "deposit" in d:
        tx = "deposit"
    elif "airtime" in d or "bundle" in d or "recharge" in d:
        tx = "airtime"
    elif "reversal" in d:
        tx = "reversal"
    elif "transfer to" in d or "send" in d:
        tx = "send"
    elif "transfer from" in d or "received" in d or "payment from" in d:
        tx = "received"
    elif "charge" in d or "transaction fee" in d or "transaction cost" in d:
        tx = "charge"
    else:
        tx = "other"

    if tx in ("buygoods", "paybill"):
        if any(k in d for k in ("kplc", "power", "electric", "water", "nairobi water")):
            cat = "utilities"
        elif any(k in d for k in ("naivas", "quickmart", "carrefour", "food", "supermarket", "tuskys")):
            cat = "food"
        elif any(k in d for k in ("uber", "bolt", "matatu", "fuel", "shell", "total", "taxi")):
            cat = "transport"
        elif any(k in d for k in ("mali", "invest")):
            cat = "investment"
        else:
            cat = "shopping"
    elif tx == "airtime":
        cat = "airtime"
    elif tx in ("send", "withdraw", "deposit", "charge", "reversal"):
        cat = tx
    elif tx == "received":
        cat = "income"
    else:
        cat = "other"
    
    return tx, cat

def parse_text_lines(lines: List[str]) -> List[dict]:
    """Parse M-PESA statement in tabular format."""
    rows = []
    
    pattern = re.compile(
        r'(?P<receipt>[A-Z0-9]{10,})\s+'
        r'(?P<date>\d{4}-\d{2}-\d{2})\s+'
        r'(?P<time>\d{2}:\d{2}:\d{2})\s+'
        r'(?P<details>.+?)\s+'
        r'(?P<status>COMPLETED|PENDING|FAILED)\s+'
        r'(?P<paid_in>[\d,]+\.?\d{0,2})\s+'
        r'(?P<withdrawn>[\d,]+\.?\d{0,2})\s+'
        r'(?P<balance>[\d,]+\.?\d{0,2})',
        re.IGNORECASE
    )
    
    for raw in lines:
        if not raw or len(raw.strip()) < 20:
            continue
        
        raw = raw.strip()
        
        if any(h in raw.lower() for h in ['receipt no', 'completion time', 'transaction status', 'paid in', 'withdraw']):
            continue
        
        m = pattern.search(raw)
        if not m:
            continue
        
        receipt = m.group('receipt')
        date_str = m.group('date')
        time_str = m.group('time')
        details = m.group('details').strip()
        status = m.group('status')
        paid_in = parse_amount(m.group('paid_in'))
        withdrawn = parse_amount(m.group('withdrawn'))
        
        if status.upper() != 'COMPLETED':
            continue
        
        if paid_in > 0 and withdrawn == 0:
            direction = "credit"
            amount = paid_in
        elif withdrawn > 0 and paid_in == 0:
            direction = "debit"
            amount = withdrawn
        else:
            continue
        
        try:
            ts = dtparser.parse(f"{date_str} {time_str}")
        except Exception:
            continue
        
        tx_type, cat = infer_type_cat(details, direction)
        
        rows.append({
            "ts": ts.isoformat(),
            "direction": direction,
            "amount": amount,
            "method": "mpesa",
            "type": tx_type,
            "counterparty": details[:200],
            "reference": receipt,
            "category": cat,
            "notes": ""
        })
    
    return rows

# ---------- M-PESA PDF Parsing Endpoints ----------
@app.post("/parse-mpesa")
async def parse_mpesa_pdf(file: UploadFile = File(...), password: str = Form(default="")):
    fname = (file.filename or "").lower()
    content = await file.read()
    size = len(content or b"")
    log.info(f"/parse-mpesa upload: name={fname!r} size={size}B")

    if not fname.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a .pdf file.")
    if not content or size < 100:
        raise HTTPException(status_code=400, detail="Empty or invalid PDF content.")

    try:
        from pypdf import PdfReader
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PyPDF not installed: {e}")

    try:
        import io as _io
        reader = PdfReader(_io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to open PDF: {e}")

    try:
        if reader.is_encrypted and password:
            ok = reader.decrypt(password)
            if not ok:
                raise HTTPException(status_code=400, detail="Invalid PDF password.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Password/auth error: {e}")

    lines: List[str] = []
    try:
        for page in reader.pages:
            text = page.extract_text() or ""
            if text:
                lines.extend(text.splitlines())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read PDF text: {e}")

    txns = parse_text_lines(lines)
    return {"count": len(txns), "transactions": txns}

class PastePayload(BaseModel):
    text: str

@app.post("/parse-text")
def parse_text(p: PastePayload):
    lines = [ln for ln in (p.text or "").splitlines()]
    txns = parse_text_lines(lines)
    return {"count": len(txns), "transactions": txns}

@app.post("/debug-mpesa-text")
async def debug_mpesa_text(file: UploadFile = File(...), password: str = Form(default="")):
    try:
        from pypdf import PdfReader
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PyPDF not installed: {e}")

    import io as _io
    content = await file.read()
    try:
        reader = PdfReader(_io.BytesIO(content))
        if reader.is_encrypted and password:
            try:
                reader.decrypt(password)
            except TypeError:
                reader.decrypt(password)
        pages_preview = []
        total_lines = 0
        for i, page in enumerate(reader.pages[:2]):
            text = page.extract_text() or ""
            lines = text.splitlines() if text else []
            total_lines += len(lines)
            pages_preview.append({"page": i+1, "lines": len(lines), "sample": lines[:10]})
        return {"pages_preview": pages_preview, "total_lines_first_two_pages": total_lines}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not extract: {e}")