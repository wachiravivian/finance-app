# debug_pdf.py - Enhanced version with M-PESA file search
import pdfplumber
import sys
import traceback
import os
from pathlib import Path
import re

def find_mpesa_pdf_files():
    """Find M-PESA PDF files specifically"""
    common_locations = [
        Path.home() / "Downloads",
        Path.home() / "Documents", 
        Path.home() / "Desktop",
        Path.home() / "OneDrive",
        Path.home() / "OneDrive\\Documents",
        Path.home() / "OneDrive\\Desktop",
        Path.cwd(),  # Current directory
    ]
    
    mpesa_files = []
    all_pdf_files = []
    
    # M-PESA file patterns
    mpesa_patterns = [
        r'.*MPESA.*\.pdf$',
        r'.*M-PESA.*\.pdf$', 
        r'.*statement.*\.pdf$',
        r'.*2547.*\.pdf$',
    ]
    
    for location in common_locations:
        if location.exists():
            for file in location.glob("**/*.pdf"):  # Search subfolders too
                all_pdf_files.append(file)
                filename = file.name.lower()
                
                # Check if it looks like an M-PESA statement
                if any(pattern in filename for pattern in ['mpesa', 'm-pesa', 'statement']):
                    mpesa_files.append(file)
                elif re.search(r'2547\d+', file.name):  # Contains phone number
                    mpesa_files.append(file)
    
    return mpesa_files, all_pdf_files

def debug_pdf(pdf_path, password=None):
    print(f"🔍 Debugging PDF: {pdf_path}")
    print(f"🔑 Password: {password if password else 'None'}")
    
    # Check if file exists
    if not os.path.exists(pdf_path):
        print(f"❌ File not found: {pdf_path}")
        
        # Search for M-PESA files specifically
        mpesa_files, all_files = find_mpesa_pdf_files()
        
        if mpesa_files:
            print(f"\n🎯 Found {len(mpesa_files)} M-PESA-like PDF files:")
            for i, pdf_file in enumerate(mpesa_files[:10]):
                print(f"  {i+1}. {pdf_file}")
        else:
            print(f"\n📄 Found {len(all_files)} total PDF files. Here are some:")
            for i, pdf_file in enumerate(all_files[:10]):
                print(f"  {i+1}. {pdf_file}")
        
        print(f"\n💡 Try one of these paths, for example:")
        if mpesa_files:
            print(f'   python debug_pdf.py "{mpesa_files[0]}"')
        elif all_files:
            print(f'   python debug_pdf.py "{all_files[0]}"')
        return False
    
    try:
        # Try without password first
        if password:
            print("🔄 Trying with password...")
            pdf = pdfplumber.open(pdf_path, password=password)
        else:
            print("🔄 Trying without password...")
            pdf = pdfplumber.open(pdf_path)
        
        print(f"✅ PDF opened successfully! Pages: {len(pdf.pages)}")
        
        # Extract text from each page
        for i, page in enumerate(pdf.pages):
            print(f"\n📄 Page {i+1}:")
            text = page.extract_text()
            if text:
                print(f"Text length: {len(text)} characters")
                print("--- FIRST 500 CHARACTERS ---")
                print(text[:500])
                print("--- END ---")
                
                # Check for M-PESA patterns
                if any(pattern in text for pattern in ['MPESA', 'Safaricom', 'Receipt No.', 'Completion Time']):
                    print("✅ This looks like an M-PESA statement!")
                
                # Show sample lines
                lines = text.split('\n')
                print(f"📝 Found {len(lines)} lines on this page")
                print("Sample transaction lines:")
                transaction_count = 0
                for j, line in enumerate(lines):
                    if any(pattern in line for pattern in ['TKE', 'TKD', 'TKC', 'TK']):  # M-PESA receipt patterns
                        print(f"  📋 {line[:100]}...")
                        transaction_count += 1
                        if transaction_count >= 5:  # Show first 5 transactions
                            break
                
            else:
                print("❌ No text extracted from this page")
        
        pdf.close()
        return True
        
    except Exception as e:
        print(f"❌ Error opening PDF: {e}")
        
        # Try common passwords if it's a password error
        if "password" in str(e).lower() or "encrypted" in str(e).lower():
            print("\n🔐 PDF appears to be password protected.")
            print("💡 Try these common M-PESA passwords:")
            common_passwords = ["12345678", "254712345678", "0712345678"]
            for pw in common_passwords:
                print(f'   python debug_pdf.py "{pdf_path}" "{pw}"')
        
        return False

def search_mpesa_files():
    """Search specifically for M-PESA files"""
    print("🔍 Searching for M-PESA statement files...")
    mpesa_files, all_files = find_mpesa_pdf_files()
    
    if mpesa_files:
        print(f"\n🎯 Found {len(mpesa_files)} M-PESA-like PDF files:")
        for i, pdf_file in enumerate(mpesa_files):
            print(f"  {i+1}. {pdf_file}")
        
        print(f"\n🚀 To test the first one:")
        print(f'   python debug_pdf.py "{mpesa_files[0]}"')
        
        # Also show files that might be M-PESA by date pattern
        print(f"\n📅 Files with recent dates (potential M-PESA statements):")
        recent_files = []
        for file in all_files[:20]:  # Check first 20 files
            if any(year in file.name for year in ['2024', '2025', '2023']):
                recent_files.append(file)
        
        for i, file in enumerate(recent_files[:5]):
            print(f"  {i+1}. {file}")
            
    else:
        print("❌ No obvious M-PESA files found.")
        print(f"\n📄 Here are some recent PDF files to check:")
        for i, pdf_file in enumerate(all_files[:10]):
            print(f"  {i+1}. {pdf_file}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python debug_pdf.py <pdf_path> [password]")
        print("\nExamples:")
        print('  python debug_pdf.py "statement.pdf"')
        print('  python debug_pdf.py "C:\\Users\\DELL\\Downloads\\statement.pdf"')
        print('  python debug_pdf.py "statement.pdf" "12345678"')
        print('\nOr search for M-PESA files:')
        print('  python debug_pdf.py --search')
        
        sys.exit(1)
    
    if sys.argv[1] == "--search":
        search_mpesa_files()
        sys.exit(0)
    
    pdf_path = sys.argv[1]
    password = sys.argv[2] if len(sys.argv) > 2 else None
    
    debug_pdf(pdf_path, password)