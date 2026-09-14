@echo off
setlocal EnableExtensions

set "INSTALLROOT=%LOCALAPPDATA%\StreamShell\TitlebarHost"
set "BOOTLOG=%INSTALLROOT%\bootstrap.log"
set "ERRLOG=%INSTALLROOT%\powershell-error.log"
set "INSTALLLOG=%INSTALLROOT%\install.log"
set "DETAILLOG=%INSTALLROOT%\install-error.txt"

if not exist "%INSTALLROOT%" mkdir "%INSTALLROOT%"

>"%BOOTLOG%" echo Stream Shell titlebar bootstrap %DATE% %TIME%
>>"%BOOTLOG%" echo LOCALAPPDATA=%LOCALAPPDATA%
>>"%BOOTLOG%" echo ScriptDir=%~dp0

if not exist "%~dp0install-titlebar-helper.ps1" (
  >>"%BOOTLOG%" echo ERROR: install-titlebar-helper.ps1 not found
  echo.
  echo Stream Shell titlebar installer could not find its PowerShell script.
  echo Expected: %~dp0install-titlebar-helper.ps1
  echo.
  pause
  exit /b 2
)

if exist "%ERRLOG%" del /q "%ERRLOG%" >nul 2>&1
if exist "%DETAILLOG%" del /q "%DETAILLOG%" >nul 2>&1

echo.
echo ==============================================
echo   Stream Shell - Titlebar Helper Installer
echo ==============================================
echo.
echo This window will stay open until you close it.
echo If Windows asks for administrator permission, approve it and return here.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-titlebar-helper.ps1" 2>>"%ERRLOG%"
set "EC=%ERRORLEVEL%"

>>"%BOOTLOG%" echo PowerShell exit code=%EC%

echo.
if "%EC%"=="0" (
  echo ==============================================
  echo   Installation completed successfully.
  echo ==============================================
  echo.
  echo Reload Stream Shell once in opera://extensions.
) else (
  echo ==============================================
  echo   INSTALLATION FAILED - exit code %EC%
  echo ==============================================
  echo.
  if exist "%DETAILLOG%" (
    echo Detailed error:
    echo ----------------------------------------------
    type "%DETAILLOG%"
    echo ----------------------------------------------
    echo.
  )
  if exist "%ERRLOG%" (
    for %%A in ("%ERRLOG%") do if %%~zA GTR 0 (
      echo PowerShell error stream:
      echo ----------------------------------------------
      type "%ERRLOG%"
      echo ----------------------------------------------
      echo.
    )
  )
  echo Install log: %INSTALLLOG%
  echo Bootstrap log: %BOOTLOG%
)

echo.
echo Press any key to close this installer.
pause >nul
endlocal & exit /b %EC%
