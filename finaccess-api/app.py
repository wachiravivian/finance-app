from __future__ import annotations
import logging
import pathlib
import re
import json
import traceback
from io import BytesIO
from typing import List, Optional, Tuple, Dict
from datetime import datetime, timedelta
from collections import Counter

import numpy as np
import pandas as pd

from dateutil import parser as dtparser
from dateutil.parser import ParserError
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import pdfplumber
import PyPDF2

# --------------------------
# App Setup
# --------------------------
app = FastAPI(title="FinAccess API", version="4.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("uvicorn.error")
BASE_DIR = pathlib.Path(__file__).resolve().parent

# --------------------------
# ML-Inspired Transaction Classifier
# --------------------------
class TransactionClassifier:
    """Simple ML-inspired classifier for transaction direction"""
    
    def __init__(self):
        self.income_keywords = {
            "received": 3, "from": 2, "deposit": 3, "credited": 3, 
            "salary": 4, "payment from": 4, "refund": 3, "reversal": 2,
            "cashback": 3, "commission": 2, "income": 4, "payment": 2
        }
        
        self.expense_keywords = {
            "sent": 3, "to": 2, "transfer": 3, "pay bill": 4, "paybill": 4,
            "buy goods": 4, "withdraw": 4, "agent": 3, "atm": 3, 
            "charge": 3, "fee": 3, "payment to": 4, "purchase": 3,
            "lipa": 3, "mpesa": 2, "paid": 3, "debited": 3
        }
    
    def classify(self, description: str, amount: float, context: str = "") -> str:
        """Classify transaction as credit (income) or debit (expense)"""
        text = (description + " " + context).lower()
        
        income_score = 0
        expense_score = 0
        
        # Score based on keywords
        for keyword, weight in self.income_keywords.items():
            if keyword in text:
                income_score += weight
        
        for keyword, weight in self.expense_keywords.items():
            if keyword in text:
                expense_score += weight
        
        # Amount-based scoring
        if amount < 0:
            expense_score += 2
        elif amount > 0:
            income_score += 1
        
        # Context clues for M-PESA specific patterns
        if "completed" in text and amount < 0:
            expense_score += 1
        if "deposit" in text and amount > 0:
            income_score += 2
        if "received from" in text:
            income_score += 3
        if "sent to" in text or "transfer to" in text:
            expense_score += 3
        if "paybill" in text or "pay bill" in text:
            expense_score += 3
        if "buy goods" in text:
            expense_score += 3
        
        log.info(f"Classification - Income: {income_score}, Expense: {expense_score}, Text: {description[:50]}")
        
        # Decide based on scores
        if income_score > expense_score:
            return "credit"
        elif expense_score > income_score:
            return "debit"
        else:
            # Tie-breaker: most transactions are expenses
            return "debit"

# Initialize the classifier
classifier = TransactionClassifier()

# --------------------------
# Health Check Endpoint
# --------------------------
@app.get("/")
async def root():
    return {"message": "FinAccess API is running"}

@app.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}

# --------------------------
# PDF Debug Endpoint
# --------------------------
@app.post("/debug-pdf")
async def debug_pdf(file: UploadFile = File(...)):
    """Debug endpoint to check PDF contents"""
    try:
        content = await file.read()
        
        result = {
            "file_name": file.filename,
            "file_size": len(content),
            "is_valid_pdf": content.startswith(b'%PDF') if content else False,
        }
        
        # Try PyPDF2 first to check encryption
        try:
            pdf_file = BytesIO(content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            result["pypdf2_info"] = {
                "pages": len(pdf_reader.pages),
                "is_encrypted": pdf_reader.is_encrypted,
                "metadata": pdf_reader.metadata if hasattr(pdf_reader, 'metadata') else {}
            }
        except Exception as e:
            result["pypdf2_error"] = str(e)
        
        # Try pdfplumber
        try:
            pdf_file = BytesIO(content)
            with pdfplumber.open(pdf_file) as pdf:
                result["pdfplumber_info"] = {
                    "pages": len(pdf.pages),
                    "page_contents": []
                }
                for i, page in enumerate(pdf.pages[:3]):
                    text = page.extract_text() or "NO TEXT"
                    result["pdfplumber_info"]["page_contents"].append({
                        "page": i + 1,
                        "text_length": len(text),
                        "first_500_chars": text[:500] if text else "NO TEXT"
                    })
        except Exception as e:
            result["pdfplumber_error"] = str(e)
            
        return result
        
    except Exception as e:
        return {"error": str(e), "traceback": traceback.format_exc()}

# --------------------------
# Text Parser Endpoint
# --------------------------
@app.post("/parse-text")
async def parse_text_endpoint(payload: dict = Body(...)):
    """Parse pasted M-PESA text"""
    try:
        text = payload.get("text", "")
        log.info(f"Received text to parse: {len(text)} characters")
        
        if not text.strip():
            return {
                "success": True,
                "count": 0,
                "transactions": [],
                "message": "No text provided"
            }

        # Parse the text
        transactions = parse_mpesa_text_improved(text)
        log.info(f"Parsed {len(transactions)} transactions from text")
        
        return {
            "success": True,
            "count": len(transactions),
            "transactions": transactions,
        }

    except Exception as e:
        log.error(f"Error in parse-text: {e}")
        log.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Text parsing error: {str(e)}")

# --------------------------
# PDF Parser Endpoint
# --------------------------
@app.post("/parse-mpesa")
async def parse_mpesa_pdf(file: UploadFile = File(...), password: str = Form(None)):
    try:
        log.info(f"Processing PDF: {file.filename}")
        
        content = await file.read()
        
        if not content.startswith(b'%PDF'):
            return {
                "success": True,
                "count": 0,
                "transactions": [],
                "warning": "Not a valid PDF file"
            }
        
        # Check if PDF is encrypted
        try:
            pdf_reader = PyPDF2.PdfReader(BytesIO(content))
            if pdf_reader.is_encrypted:
                log.info("PDF is encrypted - requiring password")
                if not password:
                    raise HTTPException(400, "PDF is encrypted. Please provide password (usually your ID number)")
                try:
                    # Try to decrypt with provided password
                    success = pdf_reader.decrypt(password)
                    if not success:
                        raise HTTPException(400, "Invalid password. Please check your password and try again.")
                    log.info("PDF successfully decrypted with provided password")
                except Exception as decrypt_error:
                    raise HTTPException(400, f"Invalid password: {str(decrypt_error)}")
        except Exception as e:
            log.warning(f"PyPDF2 encryption check failed: {e}")
        
        transactions = []
        extracted_text = ""
        
        # Try to extract text with pdfplumber
        try:
            pdf_file = BytesIO(content)
            open_kwargs = {}
            if password:
                open_kwargs['password'] = password
                
            with pdfplumber.open(pdf_file, **open_kwargs) as pdf:
                for page in pdf.pages:
                    text = page.extract_text() or ""
                    extracted_text += text + "\n"
                
                log.info(f"Extracted {len(extracted_text)} characters from PDF")
                transactions = parse_mpesa_text_improved(extracted_text)
                log.info(f"Found {len(transactions)} transactions")
                
        except Exception as e:
            error_msg = str(e)
            log.error(f"PDF processing error: {error_msg}")
            
            # If we get here with a password, it means the password was wrong
            if password:
                raise HTTPException(400, "Invalid password provided. Please check your password.")
            else:
                raise HTTPException(400, "PDF is password protected. Please provide password.")
        
        # If no transactions found
        if not transactions:
            return {
                "success": True,
                "count": 0,
                "transactions": [],
                "warning": f"No transactions found in PDF. Extracted {len(extracted_text)} characters.",
                "debug_info": f"PDF encrypted: {pdf_reader.is_encrypted if 'pdf_reader' in locals() else 'Unknown'}"
            }
        
        return {
            "success": True,
            "count": len(transactions),
            "transactions": transactions,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Unexpected error: {traceback.format_exc()}")
        raise HTTPException(500, f"Server error: {str(e)}")

# --------------------------
# Text Parsing Functions
# --------------------------
def parse_mpesa_text_improved(text: str) -> List[Dict]:
    """Parse M-PESA transaction text with support for your format"""
    transactions = []
    lines = text.split('\n')
    
    log.info(f"Parsing {len(lines)} lines of text")
    
    # Try multiple parsing methods
    transactions = (
        parse_receipt_format(lines) or  # Your format with receipt numbers
        parse_mpesa_detailed_format(lines) or  # Standard M-PESA format
        parse_generic_format(lines)  # Fallback
    )
    
    # Remove duplicates
    unique_transactions = remove_duplicate_transactions(transactions)
    
    log.info(f"Total transactions: {len(transactions)}, Unique: {len(unique_transactions)}")
    return unique_transactions

def remove_duplicate_transactions(transactions: List[Dict]) -> List[Dict]:
    """Remove duplicate transactions based on timestamp, amount, and description"""
    seen = set()
    unique_transactions = []
    
    for tx in transactions:
        # Create a unique identifier for each transaction
        identifier = (
            tx.get('ts', '')[:16],  # First 16 chars of timestamp (up to minute)
            round(tx.get('amount', 0), 2),  # Rounded amount
            tx.get('counterparty', '')[:30].lower().strip()  # First 30 chars of description
        )
        
        if identifier not in seen:
            seen.add(identifier)
            unique_transactions.append(tx)
        else:
            log.info(f"Removed duplicate transaction: {tx.get('counterparty', '')}")
    
    return unique_transactions

def parse_receipt_format(lines: List[str]) -> List[Dict]:
    """Parse your specific M-PESA format with receipt numbers"""
    transactions = []
    
    for i in range(len(lines)):
        line = lines[i].strip()
        if not line or len(line) < 10:
            continue
            
        # Look for receipt number pattern (like TKH4EAJ1EV)
        receipt_match = re.match(r'^([A-Z0-9]{9,10})\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})', line)
        if receipt_match:
            receipt_no, completion_time = receipt_match.groups()
            
            # Get the description from current line (after timestamp)
            desc_start = line.find(completion_time) + len(completion_time)
            description = line[desc_start:].strip()
            
            # Look for amount in current and next lines
            amount = None
            direction = "debit"  # Default to expense
            
            # Check current line first
            amount_match = re.search(r'-?(\d[\d,]*\.\d{2})', line)
            if amount_match:
                amount_str = amount_match.group(0)  # Get with possible negative sign
                amount = float(amount_str.replace(',', ''))
            else:
                # Check next lines for amount
                for j in range(i, min(i + 5, len(lines))):
                    next_line = lines[j].strip()
                    
                    # Look for amount patterns with better detection
                    if "Completed" in next_line:
                        # Look for negative amounts (expenses)
                        negative_match = re.search(r'-(\d[\d,]*\.\d{2})', next_line)
                        if negative_match:
                            amount = float(negative_match.group(1).replace(',', ''))
                            break
                        
                        # Look for positive amounts (income)
                        positive_match = re.search(r'(?<!-)(\d[\d,]*\.\d{2})(?=\s*[\d,]*\.\d{2}\s*$)', next_line)
                        if positive_match:
                            amount = float(positive_match.group(1).replace(',', ''))
                            break
            
            if amount is not None:
                try:
                    # Parse completion time
                    dt = dtparser.parse(completion_time)
                    
                    # Use ML classifier to determine direction
                    detected_direction = classifier.classify(description, amount, line)
                    
                    # Create transaction
                    transaction = create_transaction_from_parsed(
                        dt=dt,
                        description=description,
                        amount=amount,
                        direction=detected_direction,
                        original_line=line,
                        reference=receipt_no
                    )
                    
                    if transaction:
                        transactions.append(transaction)
                        log.info(f"Found receipt transaction: {description[:30]}... {detected_direction} KES {amount}")
                        
                except Exception as e:
                    log.debug(f"Error parsing receipt transaction: {e}")
    
    return transactions

def parse_mpesa_detailed_format(lines: List[str]) -> List[Dict]:
    """Parse standard M-PESA detailed format"""
    transactions = []
    
    for line in lines:
        line = line.strip()
        if len(line) < 10:
            continue
            
        # Skip headers
        if any(keyword in line.lower() for keyword in ['receipt', 'completion', 'details', 'status', 'paid', 'withdrawn', 'balance']):
            continue
        
        # Try different patterns
        transaction = (
            parse_detailed_line(line) or
            parse_simple_line(line)
        )
        
        if transaction:
            transactions.append(transaction)
    
    return transactions

def parse_detailed_line(line: str) -> Optional[Dict]:
    """Parse detailed transaction line"""
    try:
        # Pattern: 25/12/2023 14:30 Description Amount Balance
        pattern = r'(\d{1,2}/\d{1,2}/\d{2,4})\s+(\d{1,2}:\d{2})\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})'
        match = re.search(pattern, line)
        if match:
            date_str, time_str, description, amount_str, balance_str = match.groups()
            return create_transaction_from_components(date_str, time_str, description, amount_str, line)
    except Exception as e:
        log.debug(f"Detailed pattern failed: {e}")
    return None

def parse_simple_line(line: str) -> Optional[Dict]:
    """Parse simple transaction line"""
    try:
        # Pattern: 25/12/2023 Description Amount
        pattern = r'(\d{1,2}/\d{1,2}/\d{2,4})\s+(.+?)\s+([\d,]+\.\d{2})'
        match = re.search(pattern, line)
        if match:
            date_str, description, amount_str = match.groups()
            return create_transaction_from_components(date_str, "12:00", description, amount_str, line)
    except Exception as e:
        log.debug(f"Simple pattern failed: {e}")
    return None

def parse_generic_format(lines: List[str]) -> List[Dict]:
    """Generic fallback parser"""
    transactions = []
    
    for line in lines:
        # Look for any date and amount combination
        date_match = re.search(r'(\d{1,2}/\d{1,2}/\d{2,4})', line)
        amount_matches = re.findall(r'([\d,]+\.\d{2})', line)
        
        if date_match and amount_matches:
            try:
                date_str = date_match.group(1)
                amount_str = amount_matches[-1]  # Use last amount found
                amount = float(amount_str.replace(',', ''))
                
                # Extract description
                date_end = date_match.end()
                amount_start = line.rfind(amount_str)
                description = line[date_end:amount_start].strip()
                
                transaction = create_transaction_from_components(date_str, "12:00", description, amount_str, line)
                if transaction:
                    transactions.append(transaction)
                    
            except Exception as e:
                log.debug(f"Generic parser failed: {e}")
    
    return transactions

def create_transaction_from_components(date_str: str, time_str: str, description: str, amount_str: str, original_line: str) -> Optional[Dict]:
    """Create transaction from parsed components"""
    try:
        # Parse date
        datetime_str = f"{date_str} {time_str}"
        try:
            dt = dtparser.parse(datetime_str, dayfirst=True, fuzzy=True)
        except:
            dt = datetime.now()
        
        # Parse amount
        amount = float(amount_str.replace(',', ''))
        
        # Use ML classifier to determine direction
        detected_direction = classifier.classify(description, amount, original_line)
        
        return create_transaction_from_parsed(dt, description, amount, detected_direction, original_line)
        
    except Exception as e:
        log.error(f"Error creating transaction from components: {e}")
        return None

def create_transaction_from_parsed(dt: datetime, description: str, amount: float, direction: str, original_line: str, reference: str = "") -> Dict:
    """Create final transaction object with improved direction detection"""
    # Extract reference if not provided
    if not reference:
        ref_match = re.search(r'[A-Z0-9]{8,12}', original_line.upper())
        if ref_match:
            reference = ref_match.group(0)
    
    # Create title from description
    title = description
    if len(title) > 30:
        title = title[:30] + "..."
        
    # Infer category
    category = infer_category(description)
    
    return {
        "ts": dt.isoformat(),
        "direction": direction,  # Use ML-classified direction
        "amount": abs(amount),  # Always store positive amount
        "method": "mpesa",
        "type": "income" if direction == "credit" else "expense",
        "counterparty": description,
        "reference": reference,
        "category": category,
        "notes": original_line,
        "title": title
    }

def infer_category(description: str) -> str:
    """Improved category inference with better patterns"""
    if not description:
        return "other"
        
    desc_lower = description.lower()
    
    rules = {
        "utilities": ["kplc", "power", "electric", "water", "zuku", "internet", "wifi", "airtel"],
        "food": ["naivas", "carrefour", "quickmart", "food", "kfc", "java", "restaurant", 
                "supermarket", "nakumatt", "tuskys", "chicken", "pizza", "burger"],
        "transport": ["uber", "bolt", "fuel", "bus", "matatu", "taxi", "transport", "boda"],
        "airtime": ["airtime", "bundle", "data", "safaricom", "minutes", "sms"],
        "withdraw": ["withdraw", "agent", "atm", "cash", "collect"],
        "deposit": ["deposit", "saving"],
        "p2p": ["send to", "sent to", "transfer to", "received from", "customer transfer", 
               "funds received", "sent", "received", "to ", "from "],
        "income": ["salary", "payment from", "received from", "commission", "payment"],
        "bill": ["paybill", "bill payment", "pay bill", "rent", "school fees", "insurance"],
        "shopping": ["buy goods", "purchase", "shop", "store", "market"],
        "entertainment": ["movie", "netflix", "show", "concert", "game"],
        "charges": ["charge", "fee", "commission", "transaction fee", "service charge"],
    }
    
    # Score each category
    category_scores = {}
    
    for category, keywords in rules.items():
        score = 0
        for keyword in keywords:
            if keyword in desc_lower:
                score += 1
                # Bonus for exact matches at word boundaries
                if re.search(r'\b' + re.escape(keyword) + r'\b', desc_lower):
                    score += 1
        if score > 0:
            category_scores[category] = score
    
    if category_scores:
        # Return category with highest score
        best_category = max(category_scores.items(), key=lambda x: x[1])[0]
        return best_category
            
    return "other"

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8800, log_level="info")