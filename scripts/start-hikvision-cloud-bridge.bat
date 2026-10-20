@echo off
title [ACTIVE 24/7] Darse Burhani - Hikvision Cloud Attendance Bridge
color 0B
cd /d "%~dp0.."

:loop
cls
echo ================================================================
echo   DARSE BURHANI - HIKVISION CLOUD ATTENDANCE BRIDGE (24/7)
echo ================================================================
echo   Status       : ACTIVE - Keep this window open 24/7
echo   Working Dir  : %CD%
echo   Target Cloud : https://darse-burhani.onrender.com
echo   Terminals    : 192.168.0.4 (Entrance), 192.168.0.5 (Terminal 2)
echo ================================================================
echo.
node scripts\hikvision-cloud-bridge.mjs %*
if %ERRORLEVEL% EQU 42 (
  echo.
  echo [!] Another instance of the Hikvision Cloud Bridge is already active.
  echo [!] You can view its live dashboard at http://localhost:8099
  echo.
  timeout /t 8 /nobreak >nul
  exit /b 0
)
echo.
echo [!] Bridge process exited or stopped. Auto-restarting in 5 seconds...
timeout /t 5 /nobreak >nul
goto loop


