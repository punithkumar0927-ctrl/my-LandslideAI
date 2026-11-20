@echo off
cd /d "%~dp0"
echo ===================================================
echo Starting LandslideAI Early Warning Dashboard Server
echo ===================================================

where py >nul 2>nul
if %errorlevel% equ 0 (
  set PY_CMD=py -3.13
) else (
  set PY_CMD=python
)

echo Using Python runtime: %PY_CMD%
echo Opening server at http://127.0.0.1:5000/
echo Press Ctrl+C to stop the server.
echo.
%PY_CMD% app.py
pause
