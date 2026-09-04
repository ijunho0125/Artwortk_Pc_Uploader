@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if errorlevel 1 (
  echo Python 3 was not found.
  echo Install it from https://www.python.org/downloads/ and try again.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo [1/3] Preparing a Python environment...
  py -3 -m venv .venv
)

echo [2/3] Checking required packages...
".venv\Scripts\python.exe" -c "import flask, PIL" >nul 2>nul
if errorlevel 1 ".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
  echo Package installation failed. Check the internet connection and try again.
  pause
  exit /b 1
)

echo [3/3] Starting the Hop Hop drawing server...
".venv\Scripts\python.exe" app.py
pause
