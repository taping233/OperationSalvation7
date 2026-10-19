param(
  [Parameter(Mandatory = $true)][string]$Paths,
  [Parameter(Mandatory = $true)][string]$VerifyReport,
  [string[]]$Reports = @(),
  [string]$Attempt = 'compare-v1'
)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../../..')).Path
$comparisonRoot = Join-Path $PSScriptRoot $Attempt
if (Test-Path -LiteralPath $comparisonRoot) { throw 'Existing comparison preserved; choose another Attempt' }
New-Item -ItemType Directory -Path $comparisonRoot | Out-Null
$relativeRoot = "docs/evidence/2026-10-19-bag-reward-slice/workflow/$Attempt"
$files = @($Paths -split ',')
$inventory = @($files | ForEach-Object { @{ file = $_; sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $projectRoot $_)).Hash.ToLowerInvariant() } })
Push-Location $projectRoot
try {
  # Same verify/browser reports in both branches; no test or browser is run here.
  $legacyTimer = [Diagnostics.Stopwatch]::StartNew()
  $reviewText = & node scripts/workflow.mjs review --paths $Paths --input $VerifyReport --json
  if ($LASTEXITCODE -ne 0) { throw 'Legacy review failed' }
  $reviewText | Set-Content -Encoding utf8 -LiteralPath (Join-Path $comparisonRoot 'legacy-review.json')
  $review = $reviewText | ConvertFrom-Json
  $unverified = @()
  if ($review.verification.status -ne 'candidate') { $unverified += "workflow review: $($review.verification.status)" }
  if ($review.verification.scope -eq 'partial') { $unverified += '现有报告未覆盖全部所选范围。' }
  if ($review.ui.status -eq 'needs-manual-review') { $unverified += 'UI候选仍待当前平台内置浏览器验证；已附截图仅保留其声明的输入范围。' }
  $reportInputs = @(@{ path = $VerifyReport; coverage = "workflow verify: $($review.verification.scope); $($review.verification.status); gate $($review.plan.mode)" })
  $reportInputs += @($Reports | ForEach-Object { @{ path = $_ } })
  @{ title = '背包领奖样板对照'; paths = $files; reports = $reportInputs; unverified = @($unverified) } |
    ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8NoBOM -LiteralPath (Join-Path $comparisonRoot 'legacy-input.json')
  $legacyText = & node tools/workflow-summary.mjs --input "$relativeRoot/legacy-input.json" --out "$relativeRoot/legacy-summary" --write
  if ($LASTEXITCODE -ne 0) { throw 'Legacy summary failed; no next branch run' }
  $legacyTimer.Stop()

  $newTimer = [Diagnostics.Stopwatch]::StartNew()
  $sliceArgs = @('tools/workflow-slice.mjs', '--paths', $Paths, '--input', $VerifyReport, '--out', "$relativeRoot/slice", '--title', '背包领奖样板对照')
  foreach ($report in $Reports) { $sliceArgs += @('--report', $report) }
  $sliceText = & node @sliceArgs
  if ($LASTEXITCODE -ne 0) { throw 'Slice failed; retain existing evidence' }
  $newTimer.Stop()
  $sliceText | Set-Content -Encoding utf8NoBOM -LiteralPath (Join-Path $comparisonRoot 'slice-cli.json')
  $slice = $sliceText | ConvertFrom-Json
  $legacySummary = $legacyText | ConvertFrom-Json
  $newSummary = Get-Content -Raw -LiteralPath (Join-Path $projectRoot $slice.summary) | ConvertFrom-Json
  $sameReports = (($legacySummary.reports | ConvertTo-Json -Depth 10 -Compress) -eq ($newSummary.reports | ConvertTo-Json -Depth 10 -Compress))
  if (-not $sameReports) { throw 'Report results differ; inspect preserved outputs' }
  $inventoryAfter = @($files | ForEach-Object { @{ file = $_; sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $projectRoot $_)).Hash.ToLowerInvariant() } })
  $unchanged = (($inventory | ConvertTo-Json -Compress) -eq ($inventoryAfter | ConvertTo-Json -Compress))
  $comparison = @{ version = 1; measuredAt = (Get-Date).ToUniversalTime().ToString('o'); paths = $files; inventory = $inventory;
    verifyReport = $VerifyReport; browserReports = @($Reports); gate = $review.plan.mode; scope = $review.verification.scope;
    legacy = @{ nodeCommands = 2; explicitSummaryInputFiles = 1; wallClockMs = $legacyTimer.Elapsed.TotalMilliseconds };
    slice = @{ nodeCommands = 1; explicitSummaryInputFiles = 0; wallClockMs = $newTimer.Elapsed.TotalMilliseconds; internalTiming = $slice.timing };
    sameReportResults = $sameReports; inputsUnchangedDuringComparison = $unchanged;
    limits = @('One sequential local sample; not a speedup guarantee or percentage.', 'Reuses the same verify report; no tests/browser repeated.', 'Command count excludes the already completed verification and browser capture.') }
  $comparison | ConvertTo-Json -Depth 12 | Set-Content -Encoding utf8NoBOM -LiteralPath (Join-Path $comparisonRoot 'comparison.json')
  $comparison | ConvertTo-Json -Depth 12 -Compress
} finally { Pop-Location }
