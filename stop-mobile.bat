@echo off
title EventSphere - Stop
echo ============================================
echo   EventSphere - Stopping server and tunnel
echo ============================================
echo.
echo Working...

REM Kill the server (port 5000), ngrok, and close the start-mobile windows.
REM Windows are matched by their command line (reliable) instead of title.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue; Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'cmd.exe' -and $_.CommandLine -match 'ngrok|start-mobile|npm start' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

echo.
echo All stopped - server, tunnel, and the start-mobile windows are closed.
echo Port 5000 is free.
echo.
pause
