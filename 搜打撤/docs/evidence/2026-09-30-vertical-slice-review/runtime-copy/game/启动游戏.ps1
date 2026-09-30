# 桌面模式启动器：隐藏本地服务器 + Edge app 独立窗口（无地址栏/标签页）
# 关闭游戏窗口后服务器自动退出。
param([int]$Port = 8137)
$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$Url = "http://127.0.0.1:$Port/"

# 1. 后台起静态服务器（复用 serve.ps1 的逻辑，改为独立进程避免窗口）
$serverJob = Start-Job -ScriptBlock {
  param($Root, $Port)
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root 'serve.ps1') -Port $Port | Out-Null
} -ArgumentList $Root, $Port

# 2. 等服务器就绪
$ready = $false
for ($i = 0; $i -lt 50; $i++) {
  try {
    $resp = [Net.HttpWebRequest]::Create($Url)
    $resp.Timeout = 500
    $r = $resp.GetResponse(); $r.Close()
    $ready = $true; break
  } catch { Start-Sleep -Milliseconds 100 }
}
if (-not $ready) {
  Write-Error "本地服务器启动失败（端口 $Port）"
  Stop-Job $serverJob; Remove-Job $serverJob
  exit 1
}

# 3. 用独立用户数据目录启动 Edge app 窗口（独立进程，便于跟踪退出）
$edgeArgs = @(
  "--app=$Url",
  "--window-size=1440,900",
  "--user-data-dir=`"$env:TEMP\codename7-app-profile`""
)
$proc = Start-Process -FilePath "msedge.exe" -ArgumentList $edgeArgs -PassThru

# 4. 等游戏窗口关闭，然后清理服务器
try { $proc.WaitForExit() } catch {}
# msedge 可能立即返回主进程并 spawn 子进程，按用户数据目录再兜底等一次
$deadline = (Get-Date).AddSeconds(5)
while ((Get-Date) -lt $deadline) {
  $still = Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" |
    Where-Object { $_.CommandLine -like '*codename7-app-profile*' }
  if (-not $still) { break }
  Start-Sleep -Milliseconds 500
}
Stop-Job $serverJob -ErrorAction SilentlyContinue
Remove-Job $serverJob -ErrorAction SilentlyContinue
