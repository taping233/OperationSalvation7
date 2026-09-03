# 同步游戏内容到桌面版：prototypes/map-system → desktop-app/game
# desktop-app/game 是构建产物，唯一真源是 prototypes/map-system。
# 打包（npm run dist）前必须先跑一次：powershell -File scripts/sync-desktop.ps1
$ErrorActionPreference = 'Stop'
$src = Join-Path $PSScriptRoot '..\prototypes\map-system'
$dst = Join-Path $PSScriptRoot '..\desktop-app\game'

robocopy $src $dst /MIR /NFL /NDL /NJH /NJS | Out-Null
# robocopy 退出码 0-7 都算成功（1=有更新，8+ 才是错误）
if ($LASTEXITCODE -ge 8) { Write-Error "robocopy failed with exit code $LASTEXITCODE" }
Write-Host "已同步 prototypes/map-system → desktop-app/game (robocopy code $LASTEXITCODE)"
