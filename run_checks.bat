@echo off
cd /d "%~dp0"
py -3.13 -m py_compile app.py train_model.py
if errorlevel 1 (
  echo Python compile failed. See errors above.
  pause
  exit /b 1
)
py -3.13 run_checks.py
if errorlevel 1 (
  echo run_checks.py failed.
  pause
  exit /b 1
)
echo Done.
pause
