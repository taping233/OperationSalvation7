@echo off
rem Codename 7 (SaoDaChe) - local desktop launcher
setlocal
set "ROOT=%~dp0"
set "ELECTRON=%ROOT%desktop\electron\electron.exe"
set "APPDIR=%ROOT%desktop-app"
if not exist "%ELECTRON%" (
  echo [ERROR] Electron runtime not found:
  echo   %ELECTRON%
  echo Install it once with:
  echo   powershell -ExecutionPolicy Bypass -File "%ROOT%desktop\setup.ps1"
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found. Install Node.js before launching the development build.
  pause
  exit /b 1
)
pushd "%APPDIR%"
call npm run prestart
if errorlevel 1 (
  echo [ERROR] Game build or desktop runtime check failed.
  popd
  pause
  exit /b 1
)
start "" "%ELECTRON%" "%APPDIR%"
popd
endlocal
