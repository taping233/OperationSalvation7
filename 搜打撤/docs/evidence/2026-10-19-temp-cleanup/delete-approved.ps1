$ErrorActionPreference = 'Stop'
$project = (Get-Location).Path
$evidence = 'docs/evidence/2026-10-19-temp-cleanup'
$verification = Get-Content -LiteralPath '.tmp/cleanup-plan-1019/verified.json' -Raw | ConvertFrom-Json
$planPath = Join-Path $evidence 'plan.json'
if (-not $verification.ok -or $verification.directories.Count -ne 10 -or $verification.files.Count -ne 20230) { throw 'Invalid approved verification' }
if ((Get-FileHash -LiteralPath $planPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $verification.planSha256) { throw 'Plan changed after verification' }
$checkedAt = [DateTime]$verification.checkedAt
if (([DateTime]::UtcNow - $checkedAt.ToUniversalTime()).TotalMinutes -gt 10) { throw 'Verification is too old' }
$allowed = @(
  '.tmp/exe-stability-1018/extracted',
  '.tmp/exe-review-1018/extracted',
  '.tmp/clean-exe-1016/project/desktop-app/node_modules',
  '.tmp/clean-exe-1016/project/builder-cache',
  '.tmp/page-perf-1018/delivery/win-unpacked',
  '.tmp/deep-perf-1018/delivery/win-unpacked',
  '.tmp/startup-fix-1018/delivery/win-unpacked',
  '.tmp/exe-errors-1018/delivery/win-unpacked',
  '.tmp/exe-errors-1018/delivery-fixed/win-unpacked',
  '.tmp/exe-refresh-1018/delivery/win-unpacked'
)
foreach ($file in $verification.files) {
  $current = Get-Item -LiteralPath $file.path -Force
  $modified = ($current.LastWriteTimeUtc - [DateTime]::UnixEpoch).TotalMilliseconds
  if ($current.Length -ne $file.bytes -or [Math]::Abs($modified - $file.mtimeMs) -gt 1) { throw "File changed after verification: $($file.path)" }
}
foreach ($target in $verification.directories) {
  $resolved = (Resolve-Path -LiteralPath $target.path).Path
  if ($target.path -notin $allowed -or $resolved -ne $target.absolutePath -or -not $resolved.StartsWith((Join-Path $project '.tmp') + '\')) { throw "Unapproved absolute target: $resolved" }
  $entries = @(Get-ChildItem -LiteralPath $resolved -Recurse -Force)
  if (((Get-Item -LiteralPath $resolved -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -or @($entries | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count -gt 0) { throw "Linked path in approved directory: $resolved" }
  if (@($entries | Where-Object { -not $_.PSIsContainer }).Count -ne $target.files) { throw "Directory changed after verification: $resolved" }
}
$receipt = [ordered]@{
  status = 'deleting-approved-directories'; ok = $false; startedAt = [DateTime]::UtcNow.ToString('o')
  planSha256 = $verification.planSha256; approvedDirectories = $allowed
  deletedDirectories = @(); deletedFiles = 0; deletedBytes = 0
  retainedPortableExes = $verification.retainedPortableExes
  retainedUnpackedDirectory = $verification.retainedUnpackedDirectory
  freeBytesBefore = $verification.freeBytesBefore
}
$receiptPath = Join-Path $evidence 'deletion-receipt.json'
try {
  foreach ($target in $verification.directories) {
    $receipt | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $receiptPath -Encoding utf8
    Remove-Item -LiteralPath $target.absolutePath -Recurse -Force -ErrorAction Stop
    if (Test-Path -LiteralPath $target.absolutePath) { throw "Deletion incomplete: $($target.absolutePath)" }
    $receipt.deletedDirectories += $target.path
    $receipt.deletedFiles += $target.files
    $receipt.deletedBytes += $target.bytes
    Write-Output "Deleted: $($target.path)"
  }
  foreach ($file in $verification.retainedPortableExes) {
    if ((Get-FileHash -LiteralPath $file.path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.sha256) { throw "Retained EXE changed: $($file.path)" }
  }
  if (-not (Test-Path -LiteralPath $verification.retainedUnpackedDirectory -PathType Container)) { throw 'Retained latest unpacked delivery missing' }
  $receipt.ok = $true
  $receipt.status = 'completed'
} catch {
  $receipt.status = 'failed-preserved-partial-state'
  $receipt.error = $_.Exception.Message
  throw
} finally {
  $receipt.endedAt = [DateTime]::UtcNow.ToString('o')
  $receipt | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $receiptPath -Encoding utf8
}
Write-Output "Completed: $($receipt.deletedDirectories.Count) directories; $($receipt.deletedFiles) files; $($receipt.deletedBytes) bytes"
