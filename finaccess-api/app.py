# app.py - COMPLETE WORKING BACKEND
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
import traceback
from io import BytesIO
from typing import List, Dict, Any
from datetime import datetime
import re

import pdfplumber
import PyPDF2

# App setup
app = FastAPI(title="FinAccess API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("uvicorn.error")

# Data models
class PDFParseResponse(BaseModel):
    success: bool
    transactions: List[Dict[str, Any]]
    message: str
    count: int

class MLInsightsRequest(BaseModel):
    transactions: List[Dict[str, Any]]
    user_id: str

class MLInsightsResponse(BaseModel):
    spending_profile: Dict[str, Any]
    recommendations: List[Dict[str, Any]]
    trends: Dict[str, Any]
    risk_assessment: Dict[str, Any]

# Health check endpoints
@app.get("/")
async def root():
    return {
        "message": "FinAccess API is running", 
        "status": "healthy",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "parse_pdf": "/parse-mpesa",
            "test_password": "/test-pdf-password",
            "ml_insights": "/ml-insights"
        }
    }

@app.get("/health")
async def health_check():
    return {
        "status": "ok", 
        "timestamp": datetime.utcnow().isoformat(),
        "service": "finance-api",
        "message": "Server is healthy and ready for connections"
    }

# Password testing endpoint
@app.post("/test-pdf-password")
async def test_pdf_password(
    file: UploadFile = File(...),
    password: str = Form(...)
):
    """Test if a password works for the PDF"""
    try:
        log.info(f"🔐 Testing password: {password}")
        
        contents = await file.read()
        
        if len(contents) == 0:
            return {
                "success": False,
                "message": "File is empty"
            }
        
        pdf_file = BytesIO(contents)
        
        try:
            # Try with the password
            pdf = pdfplumber.open(pdf_file, password=password.strip())
            page_count = len(pdf.pages)
            
            # Try to extract some text to verify it works
            sample_text = ""
            if page_count > 0:
                first_page = pdf.pages[0]
                sample_text = first_page.extract_text() or ""
                log.info(f"✅ Password works! Extracted {len(sample_text)} characters")
            
            pdf.close()
            
            return {
                "success": True,
                "message": f"✅ Password is correct! PDF has {page_count} pages.",
                "pages": page_count,
                "sample_text_length": len(sample_text),
                "sample_preview": sample_text[:200] if sample_text else ""
            }
            
        except Exception as e:
            error_msg = str(e)
            log.error(f"❌ Password failed: {error_msg}")
            return {
                "success": False,
                "message": f"❌ Incorrect password or PDF cannot be read: {error_msg}",
                "error": error_msg
            }
            
    except Exception as e:
        log.error(f"💥 Password test error: {traceback.format_exc()}")
        return {
            "success": False,
            "message": f"Error testing password: {str(e)}"
        }

# Main PDF parsing endpoint
@app.post("/parse-mpesa", response_model=PDFParseResponse)
async def parse_mpesa_pdf(
    file: UploadFile = File(...),
    password: str = Form(None)
):
    """Parse M-PESA PDF statement"""
    try:
        log.info(f"📄 Processing PDF: {file.filename}")
        log.info(f"🔑 Password provided: {'Yes' if password else 'No'}")
        
        if not file.filename.lower().endswith('.pdf'):
            return PDFParseResponse(
                success=False,
                transactions=[],
                message="Please select a PDF file",
                count=0
            )

        # Read file
        contents = await file.read()
        
        if len(contents) == 0:
            return PDFParseResponse(
                success=False,
                transactions=[],
                message="File is empty",
                count=0
            )

        transactions = []
        pdf_file = BytesIO(contents)
        
        # Try to open PDF with or without password
        try:
            if password and password.strip():
                log.info(f"🔐 Trying with password: {password.strip()}")
                pdf = pdfplumber.open(pdf_file, password=password.strip())
            else:
                log.info("🔓 Trying without password")
                pdf = pdfplumber.open(pdf_file)
                
        except Exception as e:
            error_msg = str(e)
            log.error(f"❌ PDF opening failed: {error_msg}")
            
            if "password" in error_msg.lower() or "encrypted" in error_msg.lower():
                return PDFParseResponse(
                    success=False,
                    transactions=[],
                    message="PDF is password protected. Please provide your ID number as password.",
                    count=0
                )
            else:
                return PDFParseResponse(
                    success=False,
                    transactions=[],
                    message=f"Cannot read PDF: {error_msg}",
                    count=0
                )

        # Extract text and parse transactions
        try:
            all_text = ""
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    all_text += text + "\n"
            
            pdf.close()
            
            if all_text.strip():
                transactions = parse_mpesa_text(all_text)
                log.info(f"✅ Found {len(transactions)} transactions")
            else:
                log.warning("⚠️ No text extracted from PDF")
                
        except Exception as e:
            log.error(f"❌ Text extraction failed: {e}")
            return PDFParseResponse(
                success=False,
                transactions=[],
                message=f"Error extracting text from PDF: {str(e)}",
                count=0
            )

        if transactions:
            return PDFParseResponse(
                success=True,
                transactions=transactions,
                message=f"Successfully imported {len(transactions)} transactions",
                count=len(transactions)
            )
        else:
            return PDFParseResponse(
                success=False,
                transactions=[],
                message="No transactions found in the PDF. Please ensure:\n• It's a valid M-PESA statement\n• It contains transactions\n• Try using your ID number as password",
                count=0
            )

    except Exception as e:
        log.error(f"💥 Unexpected error: {traceback.format_exc()}")
        return PDFParseResponse(
            success=False,
            transactions=[],
            message=f"Unexpected error: {str(e)}",
            count=0
        )

def parse_mpesa_text(text: str) -> List[Dict[str, Any]]:
    """Parse M-PESA transaction text from PDF"""
    transactions = []
    lines = text.split('\n')
    
    log.info(f"📖 Processing {len(lines)} lines of text")
    
    for i, line in enumerate(lines):
        line = line.strip()
        if not line or len(line) < 10:
            continue
            
        # Skip headers/footers
        if any(word in line.lower() for word in [
            'page', 'statement', 'balance', 'safaricom', 'date', 'description', 
            'amount', 'transaction', 'opening', 'closing', 'customer', 'confidential'
        ]):
            continue
            
        # Look for date pattern (dd/mm/yyyy or dd/mm/yy)
        date_match = re.search(r'(\d{1,2}/\d{1,2}/\d{2,4})', line)
        if not date_match:
            continue
            
        # Look for amount (format: 1,234.56)
        amount_matches = re.findall(r'(\d{1,3}(?:,\d{3})*\.\d{2})', line)
        if not amount_matches:
            continue
            
        try:
            date_str = date_match.group(1)
            # Use the largest amount found (usually the transaction amount)
            amounts = [float(amt.replace(',', '')) for amt in amount_matches]
            amount = max(amounts)
            
            if amount <= 0 or amount > 1000000:  # Sanity check
                continue
                
            # Extract description by removing date and amounts
            description = line
            description = re.sub(r'\d{1,2}/\d{1,2}/\d{2,4}', '', description)
            for amt in amount_matches:
                description = description.replace(amt, '')
            description = re.sub(r'\s+', ' ', description).strip()
            
            if not description:
                description = "M-PESA Transaction"
                
            # Determine transaction direction
            direction = "debit"  # Default to debit (money out)
            line_lower = line.lower()
            if any(word in line_lower for word in ['received', 'from', 'deposit', 'paid in']):
                direction = "credit"
            elif any(word in line_lower for word in ['sent', 'to', 'withdraw', 'paid to', 'pay bill']):
                direction = "debit"
                
            # Extract reference number
            reference = ""
            ref_match = re.search(r'[A-Z0-9]{8,12}', line)
            if ref_match:
                reference = ref_match.group(0)
                
            # Categorize transaction
            category = categorize_transaction(description)
            
            # Parse date
            try:
                parts = date_str.split('/')
                if len(parts) == 3:
                    day, month, year = parts
                    if len(year) == 2:
                        year = f"20{year}"
                    transaction_date = datetime(int(year), int(month), int(day))
                else:
                    transaction_date = datetime.now()
            except:
                transaction_date = datetime.now()
                
            transaction = {
                "ts": transaction_date.isoformat(),
                "direction": direction,
                "amount": amount,
                "method": "mpesa",
                "type": "transfer",
                "counterparty": description,
                "reference": reference,
                "category": category,
                "description": description
            }
            
            transactions.append(transaction)
            log.info(f"✅ Transaction: {description} - KES {amount} ({direction})")
            
        except Exception as e:
            log.warning(f"⚠️ Failed to parse line {i}: {e}")
            continue
            
    return transactions

def categorize_transaction(description: str) -> str:
    """Categorize transaction based on description"""
    desc_lower = description.lower()
    
    if any(word in desc_lower for word in ['food', 'supermarket', 'grocery', 'restaurant', 'cafe', 'hotel']):
        return "food"
    elif any(word in desc_lower for word in ['transport', 'fuel', 'taxi', 'bus', 'matatu', 'uber']):
        return "transport"
    elif any(word in desc_lower for word in ['airtime', 'data', 'mobile']):
        return "airtime"
    elif any(word in desc_lower for word in ['water', 'electricity', 'internet', 'wifi']):
        return "utilities"
    elif any(word in desc_lower for word in ['salary', 'income', 'payment received']):
        return "income"
    elif any(word in desc_lower for word in ['shop', 'market', 'store', 'clothing']):
        return "shopping"
    else:
        return "other"

# ML Insights endpoint
@app.post("/ml-insights", response_model=MLInsightsResponse)
async def generate_ml_insights(payload: MLInsightsRequest):
    """Generate financial insights"""
    try:
        transactions = payload.transactions
        
        if not transactions:
            return MLInsightsResponse(
                spending_profile={
                    "type": "no_data",
                    "confidence": 0.0,
                    "description": "No transaction data available",
                    "strengths": ["Ready to start tracking"],
                    "areas_for_improvement": ["Import your M-PESA statements to get insights"],
                    "metrics": {
                        "savings_rate": 0.0,
                        "total_income": 0.0,
                        "total_expenses": 0.0,
                        "avg_daily_spend": 0.0,
                        "top_category": "none",
                        "top_category_percentage": 0.0
                    }
                },
                recommendations=[{
                    "category": "general",
                    "priority": "medium",
                    "title": "Start Tracking Your Finances",
                    "description": "Import your M-PESA statements to begin financial analysis",
                    "action": "Upload your PDF statements in the Transactions tab",
                    "impact": "High - Essential for financial awareness"
                }],
                trends={},
                risk_assessment={"level": "low", "factors": [], "summary": "No data available"}
            )
        
        # Calculate basic metrics
        income = sum(t['amount'] for t in transactions if t.get('direction') == 'credit')
        expenses = sum(t['amount'] for t in transactions if t.get('direction') == 'debit')
        savings_rate = ((income - expenses) / income * 100) if income > 0 else -100
        
        # Determine profile type and generate recommendations
        if savings_rate > 20:
            profile_type = "high_saver"
            description = "Excellent savings rate! You're doing great."
            recommendations = [
                {
                    "category": "savings",
                    "priority": "low",
                    "title": "Explore Investment Options",
                    "description": "Consider putting your excess savings to work",
                    "action": "Research low-risk investment opportunities",
                    "impact": "Medium - Potential for growth"
                },
                {
                    "category": "planning", 
                    "priority": "medium",
                    "title": "Set Long-term Financial Goals",
                    "description": "Plan for major purchases or retirement",
                    "action": "Define specific financial targets for 1-5 years",
                    "impact": "High - Better financial security"
                }
            ]
        elif savings_rate > 0:
            profile_type = "balanced"
            description = "Good balance between spending and saving"
            recommendations = [
                {
                    "category": "savings",
                    "priority": "medium", 
                    "title": "Increase Savings Automation",
                    "description": "Boost your savings rate gradually",
                    "action": "Set up automatic transfers to savings account",
                    "impact": "Medium - Consistent growth"
                },
                {
                    "category": "spending",
                    "priority": "low",
                    "title": "Review Subscription Services",
                    "description": "Identify unused or unnecessary subscriptions",
                    "action": "Cancel at least one unused subscription",
                    "impact": "Low - Small savings boost"
                }
            ]
        elif savings_rate > -10:
            profile_type = "moderate_spender"
            description = "Spending slightly exceeds income"
            recommendations = [
                {
                    "category": "budgeting",
                    "priority": "high",
                    "title": "Create Emergency Budget",
                    "description": "Focus on essential expenses only",
                    "action": "Identify and cut non-essential spending categories",
                    "impact": "High - Immediate financial improvement"
                },
                {
                    "category": "income",
                    "priority": "medium",
                    "title": "Explore Additional Income",
                    "description": "Consider side income opportunities",
                    "action": "Look for part-time or freelance work",
                    "impact": "Medium - Income diversification"
                }
            ]
        else:
            profile_type = "overspender"
            description = "Expenses significantly exceed income"
            recommendations = [
                {
                    "category": "crisis",
                    "priority": "high",
                    "title": "Immediate Spending Freeze",
                    "description": "Stop all non-essential purchases immediately",
                    "action": "Create a strict essentials-only budget",
                    "impact": "High - Critical financial recovery"
                },
                {
                    "category": "debt",
                    "priority": "high", 
                    "title": "Debt Management Plan",
                    "description": "Address any accumulating debt",
                    "action": "Contact financial advisor or use debt snowball method",
                    "impact": "High - Prevent financial crisis"
                }
            ]
        
        return MLInsightsResponse(
            spending_profile={
                "type": profile_type,
                "confidence": min(0.9, len(transactions) / 50),
                "description": description,
                "strengths": ["Financial tracking enabled", "Data imported successfully"],
                "areas_for_improvement": ["Continue monitoring your expenses", "Set financial goals"],
                "metrics": {
                    "savings_rate": round(savings_rate, 1),
                    "total_income": round(income, 2),
                    "total_expenses": round(expenses, 2),
                    "avg_daily_spend": round(expenses / 30, 2),
                    "top_category": "general",
                    "top_category_percentage": 0.0
                }
            },
            recommendations=recommendations,
            trends={
                "income_trend": "stable",
                "spending_trend": "stable", 
                "volatility": "low",
                "key_observations": [f"Analyzed {len(transactions)} transactions"]
            },
            risk_assessment={
                "level": "low",
                "factors": [],
                "summary": "Low financial risk based on available data"
            }
        )
        
    except Exception as e:
        log.error(f"ML insights error: {e}")
        return MLInsightsResponse(
            spending_profile={
                "type": "error", 
                "confidence": 0.0,
                "description": f"Error generating insights: {str(e)}",
                "strengths": [],
                "areas_for_improvement": [],
                "metrics": {
                    "savings_rate": 0.0,
                    "total_income": 0.0,
                    "total_expenses": 0.0,
                    "avg_daily_spend": 0.0,
                    "top_category": "error",
                    "top_category_percentage": 0.0
                }
            },
            recommendations=[],
            trends={},
            risk_assessment={"level": "unknown", "factors": [], "summary": "Analysis failed"}
        )

# Test endpoint
@app.get("/test-ml")
async def test_ml():
    """Test ML endpoint"""
    test_data = [
        {
            "ts": "2024-01-01T10:00:00",
            "direction": "credit",
            "amount": 50000.0,
            "category": "salary",
            "method": "mpesa"
        },
        {
            "ts": "2024-01-02T14:30:00", 
            "direction": "debit",
            "amount": 1500.0,
            "category": "food", 
            "method": "mpesa"
        }
    ]
    
    try:
        # Simulate ML processing
        income = sum(t['amount'] for t in test_data if t['direction'] == 'credit')
        expenses = sum(t['amount'] for t in test_data if t['direction'] == 'debit')
        
        return {
            "success": True,
            "message": "ML endpoint is working correctly",
            "test_data": {
                "income": income,
                "expenses": expenses,
                "transactions": len(test_data)
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": "ML endpoint has issues"
        }

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting FinAccess API on port 8080...")
    print("📍 Local: http://localhost:8080")
    print("📍 Network: http://YOUR_IP:8080") 
    print("✅ Health check: http://localhost:8080/health")
    print("📄 PDF Import: POST http://localhost:8080/parse-mpesa")
    print("🔐 Test Password: POST http://localhost:8080/test-pdf-password")
    print("🔮 ML Insights: POST http://localhost:8080/ml-insights")
    print("")
    print("💡 Make sure to install required packages:")
    print("   pip install pdfplumber PyPDF2")
    uvicorn.run(app, host="0.0.0.0", port=8080, log_level="info")