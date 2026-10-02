$ErrorActionPreference = 'Stop'
$researchRoot = Split-Path -Parent $PSScriptRoot
$researchUtf8 = New-Object System.Text.UTF8Encoding($false)
$researchPackages = @(
 @{ id='rot-js'; repo='ondras/rot.js'; commit='46782e248c2db9d379a5e4f13bb8323f18dff04b'; license='BSD-3-Clause'; files=@('license.txt','package.json','src/rng.ts','src/engine.ts','src/eventqueue.ts','src/scheduler/scheduler.ts','src/MinHeap.ts') },
 @{ id='jsfxr'; repo='chr15m/jsfxr'; commit='b7b6aa27d62f8f356db267276bf54b451555c49d'; license='Unlicense'; files=@('UNLICENSE','package.json','sfxr.js','riffwave.js') },
 @{ id='seedrandom'; repo='davidbau/seedrandom'; commit='4460ad325a0a15273a211e509f03ae0beb99511a'; license='MIT (embedded in seedrandom.js)'; files=@('package.json','seedrandom.js','lib/alea.js') },
 @{ id='howler'; repo='goldfire/howler.js'; commit='1d3053576a860e9854645493ad6c4a72c6cc6e45'; license='MIT'; files=@('LICENSE.md','package.json','src/howler.core.js') }
)
$researchManifest = @()
foreach ($researchPackage in $researchPackages) {
 foreach ($researchFile in $researchPackage.files) {
  $researchRel = 'downloads/' + $researchPackage.id + '/' + $researchFile
  $researchDest = Join-Path $researchRoot $researchRel
  [void][System.IO.Directory]::CreateDirectory((Split-Path -Parent $researchDest))
  $researchUrl = 'https://raw.githubusercontent.com/' + $researchPackage.repo + '/' + $researchPackage.commit + '/' + $researchFile
  try {
   Invoke-WebRequest -Uri $researchUrl -OutFile $researchDest -TimeoutSec 20
   $researchItem = Get-Item -LiteralPath $researchDest
   $researchManifest += [pscustomobject]@{ id=$researchPackage.id; status='downloaded'; path=$researchRel; url=$researchUrl; commit=$researchPackage.commit; license=$researchPackage.license; accessedAt=(Get-Date).ToUniversalTime().ToString('o'); bytes=$researchItem.Length; sha256=(Get-FileHash -LiteralPath $researchDest -Algorithm SHA256).Hash.ToLowerInvariant(); executed=$false }
  } catch {
   $researchManifest += [pscustomobject]@{id=$researchPackage.id; status='failed'; path=$researchRel; url=$researchUrl; commit=$researchPackage.commit; error=$_.Exception.Message; bytes=0; sha256=$null; executed=$false}
  }
 }
}
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot 'source-download-manifest.json'), (ConvertTo-Json -InputObject @($researchManifest) -Depth 8), $researchUtf8)
$researchManifest | Select-Object id,status,path,bytes | Format-Table -AutoSize
