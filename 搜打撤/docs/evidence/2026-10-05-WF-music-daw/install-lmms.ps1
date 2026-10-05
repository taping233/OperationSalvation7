$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$workstationRoot = Join-Path $projectRoot '.tmp/music-workstation'
$installRoot = Join-Path $workstationRoot 'LMMS'
$installerPath = Join-Path $workstationRoot 'lmms-1.2.2-win64.exe'
$downloadUrl = 'https://github.com/LMMS/lmms/releases/download/v1.2.2/lmms-1.2.2-win64.exe'
New-Item -ItemType Directory -Force -Path $workstationRoot | Out-Null
if (-not (Test-Path -LiteralPath $installerPath)) {
  Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath -UseBasicParsing
}
$file = Get-Item -LiteralPath $installerPath
if ($file.Length -lt 30000000) { throw 'Installer appears incomplete' }
if (-not (Test-Path -LiteralPath (Join-Path $installRoot 'lmms.exe'))) {
  $process = Start-Process -FilePath $installerPath -ArgumentList @('/S', "/D=$installRoot") -WindowStyle Hidden -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "Installer failed: $($process.ExitCode)" }
}
if (-not (Test-Path -LiteralPath (Join-Path $installRoot 'lmms.exe'))) { throw 'LMMS executable not installed' }
$record = [ordered]@{software='LMMS';version='1.2.2';source=$downloadUrl;installerBytes=$file.Length;installerSha256=(Get-FileHash -LiteralPath $installerPath -Algorithm SHA256).Hash;installRoot=$installRoot;method='official NSIS silent installer /S /D=task-directory';authorization='老板明确要求下载电脑编曲软件并接入生成试听';timestamp=(Get-Date -Format o)}
$record | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'software-install.json') -Encoding UTF8
$record | ConvertTo-Json -Compress
