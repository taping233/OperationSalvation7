$ErrorActionPreference = 'Stop'
$reviewRoot = $PSScriptRoot
$projectRoot = [IO.Path]::GetFullPath((Join-Path $reviewRoot '../../..'))
$utf8 = [Text.UTF8Encoding]::new($false)
$bridgePath = Join-Path $projectRoot 'Assets/Scripts/Sdt.Boot/BattleBridge.cs'
$bridge = [IO.File]::ReadAllText($bridgePath)
$start = $bridge.IndexOf('    public sealed class GameBattleHost :')
$end = $bridge.IndexOf('    /// <summary>命令转发：', $start)
if ($start -lt 0 -or $end -lt 0) { throw 'Cannot extract current GameBattleHost class' }
$extracted = $bridge.Substring($start, $end - $start)
$hostSource = "// Generated verbatim from current BattleBridge.cs; do not edit.`nusing System;`nusing System.Collections.Generic;`nusing System.Linq;`nusing Sdt.Core;`nusing Sdt.Core.Battle;`nusing Sdt.Run;`nusing Sdt.UI.Screens.Battle;`nusing Sdt.UI.Screens.Run;`nnamespace Sdt.Boot {`n" + $extracted + "`n}`n"
[IO.File]::WriteAllText((Join-Path $reviewRoot 'GameBattleHost.generated.cs'), $hostSource, $utf8)
$sources = @('Assets/Scripts/Sdt.Boot/BattleBridge.cs', 'Assets/Scripts/Sdt.UI/Screens/Battle/BattleSurrenderButton.cs', 'Assets/Editor/DesktopSurrenderValidation.cs')
$sources += Get-ChildItem -LiteralPath (Join-Path $projectRoot 'Assets/Scripts/Sdt.Core') -Filter '*.cs' -File -Recurse | ForEach-Object { [IO.Path]::GetRelativePath($projectRoot, $_.FullName) }
$sources += Get-ChildItem -LiteralPath (Join-Path $projectRoot 'Assets/Scripts/Sdt.Run') -Filter '*.cs' -File | Where-Object Name -ne 'AudioService.cs' | ForEach-Object { [IO.Path]::GetRelativePath($projectRoot, $_.FullName) }
$hashes = foreach ($source in $sources) { @{ path = $source.Replace('\', '/'); sha256 = (Get-FileHash -LiteralPath (Join-Path $projectRoot $source) -Algorithm SHA256).Hash.ToLowerInvariant() } }
$manifest = @{ generatedAt = [DateTime]::UtcNow.ToString('o'); scope = 'isolated headless execution, native entry prepared'; stableDuringRun = $null; files = @($hashes); generatedHostSha256 = (Get-FileHash -LiteralPath (Join-Path $reviewRoot 'GameBattleHost.generated.cs')).Hash.ToLowerInvariant() }
[IO.File]::WriteAllText((Join-Path $reviewRoot 'source-manifest.json'), ($manifest | ConvertTo-Json -Depth 5), $utf8)
Push-Location $projectRoot
try {
    & dotnet restore (Join-Path $reviewRoot 'SurrenderChecks.csproj') --configfile (Join-Path $reviewRoot 'NuGet.Config')
    if ($LASTEXITCODE -ne 0) { throw "Offline restore failed: exit $LASTEXITCODE" }
    & dotnet run --project (Join-Path $reviewRoot 'SurrenderChecks.csproj') --no-launch-profile --no-restore
    if ($LASTEXITCODE -ne 0) { throw "Isolated surrender checks failed: exit $LASTEXITCODE" }
    $changed = @($hashes | Where-Object { (Get-FileHash -LiteralPath (Join-Path $projectRoot $_.path)).Hash.ToLowerInvariant() -ne $_.sha256 })
    $manifest.stableDuringRun = $changed.Count -eq 0
    $manifest.checkedAt = [DateTime]::UtcNow.ToString('o')
    [IO.File]::WriteAllText((Join-Path $reviewRoot 'source-manifest.json'), ($manifest | ConvertTo-Json -Depth 5), $utf8)
    if ($changed.Count -gt 0) { throw ('Production inputs changed during the run: ' + ($changed.path -join ', ')) }
} finally { Pop-Location }
