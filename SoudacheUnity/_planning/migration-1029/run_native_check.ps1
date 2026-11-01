param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Output,
    [int]$TimeoutSeconds=300,
    [string]$UnityEditor
)
$ErrorActionPreference='Stop'
$projectRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if ([string]::IsNullOrWhiteSpace($UnityEditor)) {
    $versionFile=Join-Path $projectRoot 'ProjectSettings/ProjectVersion.txt'
    $versionLine=@(Select-String -LiteralPath $versionFile -Pattern '^m_EditorVersion:\s*(\S+)\s*$')
    if ($versionLine.Count -ne 1) { throw 'ProjectVersion.txt must contain exactly one m_EditorVersion.' }
    $UnityEditor=Join-Path (Join-Path $env:ProgramFiles ('Unity '+$versionLine[0].Matches[0].Groups[1].Value)) 'Editor/Unity.exe'
}
if (-not (Test-Path -LiteralPath $UnityEditor -PathType Leaf)) { throw ('Unity editor not found: '+$UnityEditor) }
$editorPath=(Resolve-Path -LiteralPath $UnityEditor).Path
$outputRoot=[System.IO.Path]::GetFullPath($Output)
if (Test-Path -LiteralPath $outputRoot) { throw 'Use a fresh evidence directory.' }
New-Item -ItemType Directory -Path $outputRoot | Out-Null
function SourceManifest {
    $manifest=[ordered]@{}
    $files=@()
    foreach ($directory in @('Assets/Scripts','Assets/Editor','ProjectSettings','Packages')) {
        $files+=Get-ChildItem -LiteralPath (Join-Path $projectRoot $directory) -File -Recurse |
            Where-Object { $_.Extension -in @('.cs','.asmdef','.json','.asset','.txt','.shader','.cginc','.uxml','.uss','.meta') }
    }
    foreach ($file in ($files | Sort-Object FullName)) {
        $relative=$file.FullName.Substring($projectRoot.Length+1).Replace('\','/')
        $manifest[$relative]=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    return $manifest
}
$before=SourceManifest
$before | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $outputRoot 'source-before.json') -Encoding UTF8
$env:SDT_UNITY_CHECK_OUTPUT=$outputRoot
$started=[DateTime]::UtcNow
$nativeProcess=Start-Process -FilePath $editorPath -ArgumentList @(
    '-batchmode','-projectPath',('"'+$projectRoot+'"'),'-executeMethod',$Method,
    '-logFile',('"'+(Join-Path $outputRoot 'unity.log')+'"')
) -WindowStyle Hidden -PassThru
Write-Output ('Unity background PID '+$nativeProcess.Id+'; '+$Method)
$timedOut=$false
while (-not $nativeProcess.WaitForExit(1000)) {
    if (([DateTime]::UtcNow-$started).TotalSeconds -gt $TimeoutSeconds) {
        $timedOut=$true
        $nativeProcess.Kill()
        $nativeProcess.WaitForExit()
        break
    }
}
$exitCode=$nativeProcess.ExitCode
$after=SourceManifest
$changed=@($before.Keys | Where-Object { -not $after.Contains($_) -or $before[$_] -ne $after[$_] })
$changed+=@($after.Keys | Where-Object { -not $before.Contains($_) })
$after | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $outputRoot 'source-after.json') -Encoding UTF8
$summary=[ordered]@{ method=$Method;pid=$nativeProcess.Id;startedAt=$started.ToString('o');endedAt=[DateTime]::UtcNow.ToString('o');exitCode=$exitCode;timedOut=$timedOut;inputsUnchanged=($changed.Count -eq 0);changedInputs=$changed;sourceCount=$before.Count;output=$outputRoot }
$summary | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $outputRoot 'process.json') -Encoding UTF8
$summary | ConvertTo-Json -Depth 5
if ($timedOut -or $exitCode -ne 0 -or $changed.Count -gt 0) { exit 2 }
exit 0
