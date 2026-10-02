$ErrorActionPreference='Stop'
$researchRoot=Split-Path -Parent $PSScriptRoot
$researchUtf8=New-Object System.Text.UTF8Encoding($false)
$researchDir=Join-Path $researchRoot 'downloads/2048'
[void][System.IO.Directory]::CreateDirectory($researchDir)
$researchCommit='478b6ec346e3787f589e4af751378d06ded4cbbc'
$researchUrl='https://codeload.github.com/gabrielecirulli/2048/zip/'+$researchCommit
$researchDest=Join-Path $researchDir '2048-source.zip'
$researchLog=@()
try {
 Invoke-WebRequest -Uri $researchUrl -OutFile $researchDest -TimeoutSec 30
 $researchLog+=[pscustomobject]@{id='2048-reference';status='downloaded';path='downloads/2048/2048-source.zip';url=$researchUrl;commit=$researchCommit;license='MIT for repository source; retain embedded third-party notices; assets not automatically approved';bytes=(Get-Item -LiteralPath $researchDest).Length;sha256=(Get-FileHash -LiteralPath $researchDest -Algorithm SHA256).Hash.ToLowerInvariant();accessedAt=(Get-Date).ToUniversalTime().ToString('o');executed=$false}
 Add-Type -AssemblyName System.IO.Compression.FileSystem
 $researchZip=[System.IO.Compression.ZipFile]::OpenRead($researchDest)
 try {
  $researchInventory=@($researchZip.Entries|ForEach-Object { [pscustomobject]@{path=$_.FullName;bytes=$_.Length} })
  [System.IO.File]::WriteAllText((Join-Path $PSScriptRoot '2048-archive-inventory.json'),(ConvertTo-Json -InputObject $researchInventory -Depth 4),$researchUtf8)
  foreach($researchEntry in $researchZip.Entries) {
   if($researchEntry.FullName -match '/(LICENSE[^/]*|README.md|js/[^/]+\.js|index.html|style/main.css)$') {
    $researchRelative=$researchEntry.FullName.Substring($researchEntry.FullName.IndexOf('/')+1)
    $researchOutput=Join-Path $researchDir ('readable/'+$researchRelative)
    [void][System.IO.Directory]::CreateDirectory((Split-Path -Parent $researchOutput))
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($researchEntry,$researchOutput,$false)
    $researchLog+=[pscustomobject]@{id='2048-reference';status='extracted';path=('downloads/2048/readable/'+$researchRelative);url=$researchUrl;archiveEntry=$researchEntry.FullName;commit=$researchCommit;license='MIT source; see LICENSE.txt';bytes=(Get-Item -LiteralPath $researchOutput).Length;sha256=(Get-FileHash -LiteralPath $researchOutput -Algorithm SHA256).Hash.ToLowerInvariant();accessedAt=(Get-Date).ToUniversalTime().ToString('o');executed=$false}
   }
  }
 } finally {$researchZip.Dispose()}
} catch {
 $researchLog+=[pscustomobject]@{id='2048-reference';status='failed';path='downloads/2048/2048-source.zip';url=$researchUrl;error=$_.Exception.Message;bytes=0;sha256=$null;executed=$false}
}
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot 'complete-game-download-manifest.json'),(ConvertTo-Json -InputObject $researchLog -Depth 8),$researchUtf8)
$researchLog|Select-Object status,path,bytes|Format-Table -AutoSize

