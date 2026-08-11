@echo off
REM Startup script for the GraphQL API Server (Windows native cmd)
cd /d "%~dp0"

echo ==^> Installing dependencies (skip if already present) ...
call npm install --no-audit --no-fund

if not defined PORT set PORT=4000
echo ==^> Starting GraphQL API Server on http://localhost:%PORT%/
echo     Authorization header: Bearer test-bearer-token-woztell-2026
echo     (Ctrl+C to stop)
echo.

set PORT=%PORT%
call npm start
pause
