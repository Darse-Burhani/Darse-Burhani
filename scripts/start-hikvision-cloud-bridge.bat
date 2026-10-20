@echo off
title Darse Burhani - Hikvision Real-Time Cloud Bridge
color 0B
:loop
cls
echo ================================================================
echo   DARSE BURHANI - HIKVISION CLOUD ATTENDANCE BRIDGE DAEMON
echo ================================================================
echo Starting local bridge daemon to sync MinMoe scans to Render...
echo Target Cloud: https://darse-burhani.onrender.com
echo.
node "%~dp0hikvision-cloud-bridge.mjs" %*
echo.
echo [!] Bridge process exited. Auto-restarting in 5 seconds...
timeout /t 5 /nobreak >nul
goto loop
