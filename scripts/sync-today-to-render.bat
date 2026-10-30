@echo off
title [1-CLICK SYNC] Darse Burhani - Sync Hikvision Scans to Render
color 0A
cd /d "%~dp0.."
cls
echo ================================================================
echo   DARSE BURHANI - ON-DEMAND HIKVISION PULL & CLOUD SYNC
echo ================================================================
echo   Terminals    : 192.168.0.4 (Entrance), 192.168.0.5 (Terminal 2)
echo   Target Cloud : https://darse-burhani.onrender.com
echo ================================================================
echo.
echo [1/2] Connecting to Hikvision terminals...
echo [2/2] Pushing all today's scans directly to Render Cloud...
echo.
node scripts\sync-all-to-render.mjs --today
echo.
echo ================================================================
echo   Done! All scans from physical terminals are now synced to Render.
echo ================================================================
echo.
pause

