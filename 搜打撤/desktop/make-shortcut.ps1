# 在桌面创建「搜打撤 · 代号7」快捷方式
$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
$target = Join-Path $repo 'desktop\electron\electron.exe'
$appDir = Join-Path $repo 'desktop\app'
$icon = Join-Path $repo 'desktop\app\icon.ico'
$lnkPath = Join-Path ([Environment]::GetFolderPath('Desktop')) '搜打撤 代号7.lnk'

$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut($lnkPath)
$lnk.TargetPath = $target
$lnk.Arguments = '"' + $appDir + '"'
$lnk.WorkingDirectory = $repo
$lnk.IconLocation = $icon
$lnk.Description = '搜打撤 · 代号7 —— 三环棋盘卡牌游戏（本地桌面版）'
$lnk.Save()
Write-Host "OK -> $lnkPath"
