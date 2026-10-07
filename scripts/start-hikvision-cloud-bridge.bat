@echo off
title Darse Burhani - Hikvision Cloud Bridge
color 0A
echo ================================================================
echo   DARSE BURHANI - HIKVISION CLOUD ATTENDANCE BRIDGE
echo ================================================================
echo Starting local bridge daemon to sync MinMoe scans to Render...
echo.
node "%~dp0hikvision-cloud-bridge.mjs"
pause
