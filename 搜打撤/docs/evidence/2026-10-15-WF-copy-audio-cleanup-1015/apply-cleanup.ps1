$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path -LiteralPath 'D:\素材\代号柒\搜打撤').Path
$taskEvidence = Join-Path $taskRoot 'docs\evidence\2026-10-15-WF-copy-audio-cleanup-1015'
$taskPlanFile = Join-Path $taskEvidence 'deletion-plan.local.json'
$taskPlanSha = '342f5be4672dac428a560682122530433ec436279f4bd4ed9a0180d82f53a81b'
if ((Get-FileHash -LiteralPath $taskPlanFile -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskPlanSha) {
    throw 'Frozen cleanup plan changed'
}
$taskPlan = Get-Content -LiteralPath $taskPlanFile -Raw -Encoding utf8 | ConvertFrom-Json
if ($taskPlan.root -ne $taskRoot -or $taskPlan.files.Count -ne 10031) { throw 'Plan root/count mismatch' }
$taskCopies = @(
    'D:\素材\代号柒\搜打撤\.tmp\zzz-base-observe-1012',
    'D:\素材\代号柒\搜打撤\.tmp\WF-battle-ui-runtime',
    'D:\素材\代号柒\搜打撤\.tmp\selection-map-observe-1011',
    'D:\素材\代号柒\搜打撤\.tmp\selection-map-repair-1012'
)
$taskMusic = @(
    'D:\素材\代号柒\搜打撤\docs\evidence\2026-10-12-WF-battle-full-loop',
    'D:\素材\代号柒\搜打撤\docs\evidence\2026-10-12-WF-battle-full-loop-v2'
)
$taskWavNames = @('bass-loop-native.wav', 'bass-two-cycles.wav', 'beat-loop-native.wav',
    'beat-two-cycles.wav', 'detail-loop-native.wav', 'kick-loop-native.wav',
    'kick-two-cycles.wav', 'theme-loop-native.wav', 'theme-two-cycles.wav')
$taskPorts = @(5335, 5337, 5338, 5346)
function Assert-OldServicesStopped {
    $taskTcp = @(netstat -ano -p tcp)
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect TCP state' }
    foreach ($taskLine in $taskTcp) {
        if ($taskLine -match '^\s*TCP\s+\S+:(\d+)\s+' -and [int]$Matches[1] -in $taskPorts) {
            throw ('Old copy port still has TCP state: ' + $taskLine)
        }
    }
    if (Get-Process -Id 37600 -ErrorAction SilentlyContinue) { throw 'Recorded old PID exists; identity must be resolved first' }
}
Assert-OldServicesStopped
$taskFreeBefore = (Get-PSDrive -Name D).Free
$taskSeen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$taskChecked = [Collections.Generic.List[object]]::new()
$taskWaveCount = 0
$taskSpecialMask = [IO.FileAttributes]::ReadOnly -bor [IO.FileAttributes]::Hidden -bor [IO.FileAttributes]::System
foreach ($taskRow in $taskPlan.files) {
    $taskTarget = [IO.Path]::GetFullPath((Join-Path $taskRoot $taskRow.path))
    if (-not $taskTarget.StartsWith($taskRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Target escapes workspace' }
    if (-not $taskSeen.Add($taskTarget)) { throw 'Duplicate deletion target' }
    $taskIsCopy = $false
    foreach ($taskCopy in $taskCopies) {
        if ($taskTarget.StartsWith($taskCopy + '\', [StringComparison]::OrdinalIgnoreCase)) { $taskIsCopy = $true }
    }
    $taskIsWave = [IO.Path]::GetDirectoryName($taskTarget) -in $taskMusic -and [IO.Path]::GetFileName($taskTarget) -in $taskWavNames
    if (-not $taskIsCopy -and -not $taskIsWave) { throw ('Unapproved target: ' + $taskTarget) }
    if ($taskIsWave) { $taskWaveCount++ }
    $taskItem = Get-Item -LiteralPath $taskTarget -Force
    if ($taskItem.PSIsContainer -or ($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Nonregular target refused' }
    if ($taskItem.Length -ne $taskRow.bytes) { throw ('Length changed: ' + $taskTarget) }
    if ((Get-FileHash -LiteralPath $taskTarget -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskRow.sha256) { throw ('SHA256 changed: ' + $taskTarget) }
    $taskArchiveLink = [int]$taskRow.links -gt 1 -and [bool]($taskItem.Attributes -band $taskSpecialMask)
    $taskChecked.Add([pscustomobject]@{ row=$taskRow; target=$taskTarget; writeTicks=$taskItem.LastWriteTimeUtc.Ticks; attributes=$taskItem.Attributes; archiveLink=$taskArchiveLink })
}
if ($taskWaveCount -ne 18) { throw 'Approved WAV count changed' }
foreach ($taskCopy in $taskCopies) {
    $taskResolved = (Resolve-Path -LiteralPath $taskCopy).Path
    if ($taskResolved -ne $taskCopy -or -not $taskResolved.StartsWith($taskRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Copy root changed' }
    if ((Get-Item -LiteralPath $taskCopy -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reparse copy root refused' }
    $taskActual = @(Get-ChildItem -LiteralPath $taskCopy -File -Recurse -Force)
    $taskExpected = @($taskChecked | Where-Object { $_.target.StartsWith($taskCopy + '\', [StringComparison]::OrdinalIgnoreCase) })
    if ($taskActual.Count -ne $taskExpected.Count) { throw ('Unexpected files appeared: ' + $taskCopy) }
}
Assert-OldServicesStopped
$taskJournalFile = Join-Path $taskEvidence 'deletion-journal.local.jsonl'
if (Test-Path -LiteralPath $taskJournalFile) { throw 'Existing journal refused; inspect prior state first' }
$taskJournal = [IO.StreamWriter]::new($taskJournalFile, $false, [Text.UTF8Encoding]::new($false))
$taskJournal.AutoFlush = $true
$taskDeletedFiles = 0
$taskDeletedBytes = [long]0
$taskMoved = [Collections.Generic.List[object]]::new()
try {
    foreach ($taskCheckedRow in $taskChecked) {
        $taskItem = Get-Item -LiteralPath $taskCheckedRow.target -Force
        if ($taskItem.Length -ne $taskCheckedRow.row.bytes -or $taskItem.LastWriteTimeUtc.Ticks -ne $taskCheckedRow.writeTicks) { throw 'Target changed during cleanup' }
        if ($taskCheckedRow.archiveLink) {
            $taskDestination = [IO.Path]::GetFullPath((Join-Path $taskEvidence ('preserved\readonly-shared-links\' + $taskItem.Name)))
            if (-not $taskDestination.StartsWith($taskEvidence + '\preserved\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Archive path escapes preservation root' }
            if (Test-Path -LiteralPath $taskDestination) { throw 'Archive path already exists' }
            New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($taskDestination)) -Force | Out-Null
            Move-Item -LiteralPath $taskCheckedRow.target -Destination $taskDestination -ErrorAction Stop
            if ((Get-FileHash -LiteralPath $taskDestination -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskCheckedRow.row.sha256) { throw 'Moved hardlink content mismatch' }
            if ((Get-Item -LiteralPath $taskDestination -Force).Attributes -ne $taskCheckedRow.attributes) { throw 'Moved hardlink attributes changed' }
            $taskMoved.Add([pscustomobject]@{ path=$taskDestination.Substring($taskRoot.Length + 1).Replace('\','/'); bytes=$taskItem.Length; sha256=$taskCheckedRow.row.sha256; source=$taskCheckedRow.row.path; attributes=$taskCheckedRow.attributes.ToString() })
            $taskJournal.WriteLine((@{path=$taskCheckedRow.row.path;bytes=$taskItem.Length;operation='archive-readonly-hardlink'} | ConvertTo-Json -Compress))
        } else {
            if ($taskItem.Attributes -band $taskSpecialMask) {
                Remove-Item -LiteralPath $taskCheckedRow.target -Force -ErrorAction Stop
            } else {
                Remove-Item -LiteralPath $taskCheckedRow.target -ErrorAction Stop
            }
            if (Test-Path -LiteralPath $taskCheckedRow.target) { throw 'Deleted file still exists' }
            $taskDeletedFiles++
            $taskDeletedBytes += $taskItem.Length
            $taskJournal.WriteLine((@{path=$taskCheckedRow.row.path;bytes=$taskItem.Length;operation='delete'} | ConvertTo-Json -Compress))
        }
    }
    foreach ($taskCopy in $taskCopies) {
        $taskDirectories = @(Get-ChildItem -LiteralPath $taskCopy -Directory -Recurse -Force | Sort-Object { $_.FullName.Length } -Descending)
        foreach ($taskDirectory in @($taskDirectories) + @((Get-Item -LiteralPath $taskCopy -Force))) {
            $taskPath = $taskDirectory.FullName
            if ($taskPath -ne $taskCopy -and -not $taskPath.StartsWith($taskCopy + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Empty-directory path escaped copy root' }
            if ($taskDirectory.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reparse directory refused' }
            if (@(Get-ChildItem -LiteralPath $taskPath -Force).Count -ne 0) { throw 'Unplanned content remains; no recursive removal performed' }
            Remove-Item -LiteralPath $taskPath -Force -ErrorAction Stop
        }
    }
} finally {
    $taskJournal.Dispose()
    @{ files=@($taskMoved.ToArray()) } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $taskEvidence 'moved-hardlinks.json') -Encoding utf8
    @{ at=[DateTimeOffset]::UtcNow.ToString('o'); planSha256=$taskPlanSha; deletedFiles=$taskDeletedFiles; deletedBytes=$taskDeletedBytes; archivedReadonlyHardlinks=$taskMoved.Count; diskFreeBefore=$taskFreeBefore; diskFreeAfter=(Get-PSDrive -Name D).Free } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $taskEvidence 'deletion-receipt.json') -Encoding utf8
}
Assert-OldServicesStopped
Get-Content -LiteralPath (Join-Path $taskEvidence 'deletion-receipt.json') -Raw
