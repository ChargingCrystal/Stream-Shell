@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall-cobol-finance.ps1" %*
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" (
    echo.
    echo COBOL finance removal failed with exit code %EXITCODE%.
    pause
)
exit /b %EXITCODE%
