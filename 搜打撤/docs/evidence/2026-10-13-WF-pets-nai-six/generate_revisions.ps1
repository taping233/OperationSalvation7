$ErrorActionPreference = 'Stop'
$python = 'C:\Users\太平\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$script = Join-Path $PSScriptRoot 'generate.py'
foreach ($pet in @('falcon', 'fire')) {
    $output = Join-Path $PSScriptRoot "source/$pet-v2.png"
    if (Test-Path -LiteralPath $output) {
        Write-Output "SKIP existing $pet-v2"
        continue
    }
    & $python $script $pet --variant v2
    if ($LASTEXITCODE -ne 0) { throw "NAI failed for $pet-v2 with exit code $LASTEXITCODE" }
}
