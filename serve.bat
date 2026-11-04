@echo off
setlocal
cd /d "%~dp0"
echo.
echo   Kartidaya - server lokal
echo   ---------------------------------------------
where python >nul 2>nul
if errorlevel 1 (
  echo   Python tidak ditemukan di PATH.
  echo   Install Python 3 dari https://www.python.org/downloads/
  echo   lalu jalankan file ini lagi.
  echo.
  pause
  exit /b 1
)
python serve.py
echo.
pause
