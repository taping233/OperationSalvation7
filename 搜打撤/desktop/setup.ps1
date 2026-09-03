# 下载并解压 Electron 运行时到 desktop\electron（只需在缺失时执行一次）
# 用法：powershell -ExecutionPolicy Bypass -File desktop\setup.ps1
$ErrorActionPreference = 'Stop'

$ver = '44.1.0'
$root = $PSScriptRoot
$exe = Join-Path $root 'electron\electron.exe'
if (Test-Path $exe) { Write-Host "已存在，无需安装: $exe"; exit 0 }

$zip = Join-Path $root "electron-v$ver-win32-x64.zip"
$url = "https://registry.npmmirror.com/-/binary/electron/v$ver/electron-v$ver-win32-x64.zip"
if (-not (Test-Path $zip)) {
    Write-Host "下载 $url"
    curl.exe -L --retry 3 --retry-delay 2 -o $zip $url
}
if ((Get-Item $zip).Length -lt 100MB) { throw 'zip 下载不完整，请删除后重试' }

New-Item -ItemType Directory -Force -Path (Join-Path $root 'electron') | Out-Null
tar -xf $zip -C (Join-Path $root 'electron')
Remove-Item $zip
Write-Host "完成 -> $exe"
