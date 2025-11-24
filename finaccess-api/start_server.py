# start_server.py - Simple server starter
import subprocess
import sys
import os

def main():
    print("🚀 Starting FinAccess API Server...")
    print("📍 Port: 8080")
    print("📍 Host: 0.0.0.0 (accessible from network)")
    print("")
    
    try:
        # Try to start the server
        os.chdir(os.path.dirname(os.path.abspath(__file__)))
        subprocess.run([
            sys.executable, "-m", "uvicorn", "app:app", 
            "--host", "0.0.0.0", 
            "--port", "8080", 
            "--reload"
        ], check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to start server: {e}")
        print("")
        print("🔧 Alternative: Run this command manually:")
        print("uvicorn app:app --reload --host 0.0.0.0 --port 8080")
    except FileNotFoundError:
        print("❌ uvicorn not found. Install it with:")
        print("pip install uvicorn")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    main()