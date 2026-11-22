@echo off
setlocal EnableExtensions
echo Checking the native hang recorder before installation...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tests\compile-titlebar-host.ps1"
if errorlevel 1 goto failed
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tests\test-hang-diagnostics.ps1"
if errorlevel 1 goto failed
call "%~dp0install-titlebar-helper.cmd"
exit /b %ERRORLEVEL%
:failed
echo.
echo Checks failed. The installed native helper was NOT replaced.
echo Copy the error above for diagnosis.
pause
exit /b 1
