@echo off
title MBG's GameMaster Screen server
setlocal
cd /d "%~dp0"

where dotnet >nul 2>nul
if errorlevel 1 (
  echo .NET SDK not found - opening the static app directly.
  start "" "%~dp0index.html"
  exit /b 0
)

echo Starting MBG's GameMaster Screen on http://localhost:5178 ...
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "$u='http://localhost:5178'; for($i=0;$i -lt 40;$i++){ try { Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 1 | Out-Null; break } catch { Start-Sleep -Milliseconds 500 } }; Start-Process $u"
dotnet run --project "%~dp0tools\Server" -c Release

endlocal
