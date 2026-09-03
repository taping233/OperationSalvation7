@echo off
rem Codename 7 (SaoDaChe) - local desktop launcher
setlocal
set "ROOT=%~dp0"
set "ELECTRON=%ROOT%desktop\electron\electron.exe"
set "APPDIR=%ROOT%desktop\app"
if not exist "%ELECTRON%" (
  echo [ERROR] Electron runtime not found:
  echo   %ELECTRON%
  echo Install it once with:
  echo   powershell -ExecutionPolicy Bypass -File "%ROOT%desktop\setup.ps1"
  pause
  exit /b 1
)
start "" "%ELECTRON%" "%APPDIR%"
endlocal
