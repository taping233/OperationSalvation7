@echo off
rem 双击即可启动：无控制台窗口，Edge 独立 app 窗口打开游戏
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0启动游戏.ps1"
