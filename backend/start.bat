@echo off
cd /d %~dp0
call venv\Scripts\activate 2>nul || echo [!!] 请先创建 venv: python -m venv venv
echo [Backend] Starting Agnes Studio API server on http://127.0.0.1:9191 ...
python -m uvicorn main:app --host 127.0.0.1 --port 9191 --reload
