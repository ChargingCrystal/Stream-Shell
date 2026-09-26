@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-unified-remote.ps1"
set "EXITCODE=%ERRORLEVEL%"
echo.
if not "%EXITCODE%"=="0" (
  echo Stream Shell Unified Remote installation failed with exit code %EXITCODE%.
) else (
  echo Stream Shell Unified Remote installation finished.
)
pause
exit /b %EXITCODE%
