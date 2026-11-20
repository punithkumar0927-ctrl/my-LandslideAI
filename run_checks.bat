@echo off
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel% equ 0 (
  set PY_CMD=py -3.13
) else (
  set PY_CMD=python
)

echo Running LandslideAI validation checks using %PY_CMD%...
%PY_CMD% run_checks.py
if errorlevel 1 (
  echo.
  echo [ERROR] Validation checks failed.
  pause
  exit /b 1
)

echo.
echo [SUCCESS] All checks completed successfully.
pause
