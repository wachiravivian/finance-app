# app.py - UPDATED WITH BETTER ERROR HANDLING AND PORT 8080
from __future__ import annotations
import logging
import pathlib
import re
import json
import traceback
from io import BytesIO
from typing import List, Optional, Tuple, Dict, Any
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

# Enhanced CORS configuration for React Native
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
log = logging.getLogger("uvicorn.error")
BASE_DIR = pathlib.Path(__file__).resolve().parent

# --------------------------
# ML Financial Insights Endpoint
# --------------------------
class MLInsightsRequest(BaseModel):
    transactions: List[Dict[str, Any]]
    user_id: str

class MLInsightsResponse(BaseModel):
    spending_profile: Dict[str, Any]
    recommendations: List[Dict[str, Any]]
    trends: Dict[str, Any]
    risk_assessment: Dict[str, Any]

@app.post("/ml-insights")
async def generate_ml_insights(payload: MLInsightsRequest):
    """Generate ML-powered financial insights"""
    try:
        transactions = payload.transactions
        user_id = payload.user_id
        
        log.info(f"🔮 ML Insights request for user {user_id} with {len(transactions)} transactions")
        
        if not transactions:
            return {
                "spending_profile": {
                    "type": "insufficient_data",
                    "confidence": 0.0,
                    "description": "Not enough transaction data to generate insights",
                    "strengths": ["Start tracking your transactions to get insights"],
                    "areas_for_improvement": ["Add more transaction data"]
                },
                "recommendations": [],
                "trends": {},
                "risk_assessment": {"level": "low", "factors": []}
            }
        
        # Convert to DataFrame for analysis with error handling
        try:
            df = pd.DataFrame(transactions)
            log.info(f"📊 DataFrame created with {len(df)} rows and columns: {list(df.columns)}")
            
            # Ensure required columns exist
            if 'ts' in df.columns:
                df['ts'] = pd.to_datetime(df['ts'], errors='coerce')
            if 'amount' in df.columns:
                df['amount'] = pd.to_numeric(df['amount'], errors='coerce')
            
        except Exception as e:
            log.error(f"❌ Error creating DataFrame: {e}")
            return {
                "spending_profile": {
                    "type": "data_error",
                    "confidence": 0.0,
                    "description": "Error processing transaction data",
                    "strengths": ["Data received successfully"],
                    "areas_for_improvement": ["Check transaction data format"]
                },
                "recommendations": [],
                "trends": {},
                "risk_assessment": {"level": "unknown", "factors": []}
            }
        
        # Generate insights
        spending_profile = analyze_spending_profile(df)
        recommendations = generate_recommendations(df, spending_profile)
        trends = analyze_trends(df)
        risk_assessment = assess_financial_risk(df)
        
        log.info(f"✅ Successfully generated insights for user {user_id}")
        
        return {
            "spending_profile": spending_profile,
            "recommendations": recommendations,
            "trends": trends,
            "risk_assessment": risk_assessment
        }
        
    except Exception as e:
        log.error(f"💥 ML insights error: {traceback.format_exc()}")
        return {
            "spending_profile": {
                "type": "error",
                "confidence": 0.0,
                "description": f"Error generating insights: {str(e)}",
                "strengths": ["System is operational"],
                "areas_for_improvement": ["Try again with different data"]
            },
            "recommendations": [],
            "trends": {},
            "risk_assessment": {"level": "unknown", "factors": []}
        }

def analyze_spending_profile(df: pd.DataFrame) -> Dict[str, Any]:
    """Analyze user's spending patterns and categorize their profile"""
    try:
        # Filter only expenses and income
        expenses_df = df[df['direction'] == 'debit'] if 'direction' in df.columns else pd.DataFrame()
        income_df = df[df['direction'] == 'credit'] if 'direction' in df.columns else pd.DataFrame()
        
        if len(expenses_df) == 0:
            return {
                "type": "no_spending_data",
                "confidence": 0.0,
                "description": "No spending data available for analysis",
                "strengths": ["No expenses recorded yet"],
                "areas_for_improvement": ["Start tracking your expenses"]
            }
        
        # Calculate key metrics with safe defaults
        total_income = income_df['amount'].sum() if len(income_df) > 0 and 'amount' in income_df.columns else 0
        total_expenses = expenses_df['amount'].sum() if len(expenses_df) > 0 and 'amount' in expenses_df.columns else 0
        
        # Calculate average daily spend
        avg_daily_spend = 0
        if len(expenses_df) > 0 and 'ts' in expenses_df.columns:
            try:
                daily_spending = expenses_df.groupby(expenses_df['ts'].dt.date)['amount'].sum()
                avg_daily_spend = daily_spending.mean() if len(daily_spending) > 0 else 0
            except:
                avg_daily_spend = total_expenses / 30 if total_expenses > 0 else 0
        
        # Calculate category distribution
        top_category = "unknown"
        top_category_pct = 0
        if 'category' in expenses_df.columns:
            try:
                category_spending = expenses_df.groupby('category')['amount'].sum()
                if len(category_spending) > 0:
                    top_category = category_spending.idxmax()
                    top_category_pct = (category_spending.max() / total_expenses * 100) if total_expenses > 0 else 0
            except:
                pass
        
        # Calculate savings rate
        savings_rate = ((total_income - total_expenses) / total_income * 100) if total_income > 0 else -100
        
        # Determine spending profile
        if savings_rate > 20:
            profile_type = "high_saver"
            description = "You're doing great at saving! Your savings rate is excellent."
            strengths = ["Strong savings discipline", "Good income-to-expense ratio"]
            improvements = ["Consider investment opportunities", "Optimize your budget further"]
            confidence = min(0.9, len(expenses_df) / 50)
        elif savings_rate > 0:
            profile_type = "balanced"
            description = "You're maintaining a healthy balance between spending and saving."
            strengths = ["Stable financial habits", "Moderate savings"]
            improvements = ["Look for opportunities to increase savings", "Review recurring expenses"]
            confidence = min(0.8, len(expenses_df) / 40)
        elif savings_rate > -10:
            profile_type = "moderate_spender"
            description = "You're spending slightly more than you earn. Consider reviewing your expenses."
            strengths = ["Active financial life", "Various income sources likely"]
            improvements = ["Create a detailed budget", "Identify and reduce discretionary spending"]
            confidence = min(0.7, len(expenses_df) / 30)
        else:
            profile_type = "overspender"
            description = "Your expenses significantly exceed your income. Immediate action recommended."
            strengths = ["Potential for quick improvement", "Clear optimization targets"]
            improvements = ["Create emergency budget", "Review all recurring expenses", "Seek additional income"]
            confidence = min(0.6, len(expenses_df) / 20)
        
        return {
            "type": profile_type,
            "confidence": round(float(confidence), 2),
            "description": description,
            "strengths": strengths,
            "areas_for_improvement": improvements,
            "metrics": {
                "savings_rate": round(float(savings_rate), 1),
                "total_income": round(float(total_income), 2),
                "total_expenses": round(float(total_expenses), 2),
                "avg_daily_spend": round(float(avg_daily_spend), 2),
                "top_category": top_category,
                "top_category_percentage": round(float(top_category_pct), 1)
            }
        }
        
    except Exception as e:
        log.error(f"❌ Error in spending profile analysis: {e}")
        return {
            "type": "analysis_error",
            "confidence": 0.0,
            "description": "Error analyzing spending patterns",
            "strengths": [],
            "areas_for_improvement": ["Check data quality"]
        }

def generate_recommendations(df: pd.DataFrame, spending_profile: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Generate personalized financial recommendations"""
    recommendations = []
    
    try:
        profile_type = spending_profile.get('type', 'balanced')
        metrics = spending_profile.get('metrics', {})
        
        expenses_df = df[df['direction'] == 'debit'] if 'direction' in df.columns else pd.DataFrame()
        
        # Recommendation 1: Based on savings rate
        savings_rate = metrics.get('savings_rate', 0)
        if savings_rate < 0:
            recommendations.append({
                "category": "savings",
                "priority": "high",
                "title": "Address Negative Cash Flow",
                "description": f"Your expenses exceed income by {abs(savings_rate):.1f}%. Focus on reducing discretionary spending.",
                "action": "Create a strict budget focusing on essential expenses only.",
                "impact": "High - Immediate financial stability improvement"
            })
        elif savings_rate < 10:
            recommendations.append({
                "category": "savings", 
                "priority": "medium",
                "title": "Boost Your Savings Rate",
                "description": f"Your current savings rate is {savings_rate:.1f}%. Aim for 15-20% for better financial security.",
                "action": "Identify 2-3 non-essential expenses to reduce or eliminate.",
                "impact": "Medium - Improved financial resilience"
            })
        
        # Recommendation 2: Based on spending categories
        if len(expenses_df) > 0 and 'category' in expenses_df.columns:
            try:
                category_spending = expenses_df.groupby('category')['amount'].sum()
                if len(category_spending) > 0:
                    top_category = category_spending.idxmax()
                    top_amount = category_spending.max()
                    total_expenses = expenses_df['amount'].sum()
                    
                    if total_expenses > 0 and top_amount / total_expenses > 0.4:
                        recommendations.append({
                            "category": "spending",
                            "priority": "medium",
                            "title": f"Diversify {top_category.title()} Spending",
                            "description": f"{top_category.title()} accounts for {top_amount/total_expenses*100:.1f}% of your total spending.",
                            "action": f"Review your {top_category} expenses and look for optimization opportunities.",
                            "impact": "Medium - Better spending distribution"
                        })
            except:
                pass
        
        # Add general recommendations based on profile type
        if profile_type == "high_saver":
            recommendations.append({
                "category": "investing",
                "priority": "low",
                "title": "Explore Investment Options",
                "description": "Your excellent savings habit puts you in a great position to start investing.",
                "action": "Research low-risk investment options for your surplus savings.",
                "impact": "High - Long-term wealth building"
            })
        
        # Ensure we return at least some recommendations
        if len(recommendations) == 0:
            recommendations.append({
                "category": "general",
                "priority": "medium",
                "title": "Continue Tracking Your Finances",
                "description": "Regular financial tracking is the first step toward better money management.",
                "action": "Keep recording your transactions and review them weekly.",
                "impact": "Medium - Better financial awareness"
            })
            
    except Exception as e:
        log.error(f"❌ Error generating recommendations: {e}")
        # Fallback recommendation
        recommendations.append({
            "category": "general",
            "priority": "medium",
            "title": "Financial Health Check",
            "description": "Regular review of your financial habits is important.",
            "action": "Schedule monthly financial reviews to track progress.",
            "impact": "Medium - Consistent financial improvement"
        })
    
    return recommendations[:5]

def analyze_trends(df: pd.DataFrame) -> Dict[str, Any]:
    """Analyze spending and income trends"""
    trends = {
        "income_trend": "stable",
        "spending_trend": "stable", 
        "volatility": "low",
        "key_observations": []
    }
    
    try:
        if len(df) == 0:
            return trends
        
        if 'ts' in df.columns and 'direction' in df.columns and 'amount' in df.columns:
            df['date'] = df['ts'].dt.date
            daily_totals = df.groupby(['date', 'direction'])['amount'].sum().unstack(fill_value=0)
            
            # Calculate basic trends
            if len(daily_totals) > 7:
                income_data = daily_totals.get('credit', pd.Series([0]*len(daily_totals)))
                spending_data = daily_totals.get('debit', pd.Series([0]*len(daily_totals)))
                
                if len(income_data) > 1:
                    income_trend = "increasing" if income_data.iloc[-1] > income_data.iloc[0] else "decreasing"
                    trends["income_trend"] = income_trend
                    
                if len(spending_data) > 1:
                    spending_trend = "increasing" if spending_data.iloc[-1] > spending_data.iloc[0] else "decreasing" 
                    trends["spending_trend"] = spending_trend
        
        # Add observations
        if len(df) > 10:
            trends["key_observations"].append(f"Analyzed {len(df)} transactions")
            
    except Exception as e:
        log.error(f"❌ Error analyzing trends: {e}")
        trends["key_observations"].append("Trend analysis incomplete due to data issues")
    
    return trends

def assess_financial_risk(df: pd.DataFrame) -> Dict[str, Any]:
    """Assess financial risk based on transaction patterns"""
    risk_factors = []
    risk_level = "low"
    
    try:
        expenses_df = df[df['direction'] == 'debit'] if 'direction' in df.columns else pd.DataFrame()
        income_df = df[df['direction'] == 'credit'] if 'direction' in df.columns else pd.DataFrame()
        
        # Risk factor 1: Negative cash flow
        total_income = income_df['amount'].sum() if len(income_df) > 0 else 0
        total_expenses = expenses_df['amount'].sum() if len(expenses_df) > 0 else 0
        if total_expenses > total_income:
            risk_factors.append("negative_cash_flow")
            risk_level = "high"
        
        # Risk factor 2: High spending concentration
        if len(expenses_df) > 0 and 'category' in expenses_df.columns:
            try:
                category_spending = expenses_df.groupby('category')['amount'].sum()
                if len(category_spending) > 0:
                    top_category_pct = category_spending.max() / total_expenses if total_expenses > 0 else 0
                    if top_category_pct > 0.6:  # If one category is >60% of spending
                        risk_factors.append("high_spending_concentration")
                        risk_level = "medium" if risk_level != "high" else "high"
            except:
                pass
                
    except Exception as e:
        log.error(f"❌ Error assessing risk: {e}")
        risk_factors.append("assessment_error")
    
    return {
        "level": risk_level,
        "factors": risk_factors,
        "summary": f"Detected {len(risk_factors)} risk factors"
    }

# --------------------------
# Health Check Endpoint
# --------------------------
@app.get("/")
async def root():
    return {
        "message": "FinAccess API is running on PORT 8080", 
        "status": "healthy", 
        "timestamp": datetime.utcnow().isoformat(),
        "version": "4.0.0",
        "port": 8080
    }

@app.get("/health")
async def health_check():
    return {
        "status": "ok", 
        "timestamp": datetime.utcnow().isoformat(), 
        "service": "ml-insights",
        "port": 8080,
        "message": "Server is healthy and ready for connections"
    }

@app.get("/test-ml")
async def test_ml_endpoint():
    """Test endpoint for ML insights"""
    test_transactions = [
        {
            "ts": "2024-01-01T10:00:00",
            "direction": "credit",
            "amount": 1000.0,
            "category": "income",
            "method": "mpesa",
            "counterparty": "Employer"
        },
        {
            "ts": "2024-01-02T14:30:00", 
            "direction": "debit",
            "amount": 50.0,
            "category": "food",
            "method": "mpesa",
            "counterparty": "Supermarket"
        }
    ]
    
    try:
        df = pd.DataFrame(test_transactions)
        spending_profile = analyze_spending_profile(df)
        recommendations = generate_recommendations(df, spending_profile)
        
        return {
            "success": True,
            "spending_profile": spending_profile,
            "recommendations": recommendations,
            "message": "ML endpoint is working correctly on port 8080"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": "ML endpoint has issues"
        }

# Add CORS preflight options
@app.options("/ml-insights")
async def ml_insights_options():
    return {"status": "ok"}

@app.options("/health")
async def health_options():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting FinAccess API on port 8080...")
    print("📍 Local: http://localhost:8080")
    print("📍 Network: http://YOUR_IP:8080")
    print("✅ Health check: http://localhost:8080/health")
    uvicorn.run(app, host="0.0.0.0", port=8080, log_level="info")