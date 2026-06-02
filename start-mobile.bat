@echo off
title EventSphere Mobile Launcher
echo ============================================
echo   EventSphere - Mobile PWA Launcher
echo ============================================
echo.

echo Cleaning up any old server / tunnel still running...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000" ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
taskkill /IM ngrok.exe /F >nul 2>&1
echo Done.
echo.

echo Starting server and tunnel in separate windows...
start "EventSphere Server" cmd /k "cd /d F:\EventSphere\eventsphere\server && npm start"

timeout /t 4 /nobreak >nul

start "EventSphere Tunnel" cmd /k "npx ngrok http --url=https://stand-sharpness-subplot.ngrok-free.dev 5000"

echo.
echo ============================================
echo   Mobile URL  :  https://stand-sharpness-subplot.ngrok-free.dev
echo   Desktop URL :  http://localhost:5000      (built version)
echo.
echo   For live-reload desktop dev, also run in the client folder:
echo       npm start          ^(opens http://localhost:3000^)
echo.
echo   After changing client code, run "npm run build" in client
echo   so the mobile / port-5000 version updates.
echo.
echo   To stop everything cleanly: run  stop-mobile.bat
echo ============================================
echo.
pause
