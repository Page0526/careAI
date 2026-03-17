@echo off
:: CareAI Startup Script for Windows VPS
echo ============================================
echo   CareAI MVP - Starting Services
echo ============================================

:: 1. Start Backend (FastAPI)
echo [1/3] Starting FastAPI backend on port 8000...
cd /d E:\project\hackathonPhenika\backend
start "CareAI-Backend" python -m uvicorn main:app --host 0.0.0.0 --port 8000
timeout /t 3 >nul

:: 2. Seed database if needed
echo [2/3] Checking database...
python -c "from data.seed import seed_database; seed_database()"

:: 3. Start Frontend (Next.js)
echo [3/3] Starting Next.js frontend on port 3000...
cd /d E:\project\hackathonPhenika\frontend
start "CareAI-Frontend" yarn dev

echo.
echo ============================================
echo   CareAI is running!
echo   Frontend: http://localhost:3000/hackathon
echo   Backend:  http://localhost:8000/hackathon/api
echo   API Docs: http://localhost:8000/docs
echo ============================================
echo.
pause
