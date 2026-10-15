$ErrorActionPreference = 'Stop'
$python = 'C:\Users\太平\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$script = Join-Path $PSScriptRoot 'generate.py'
foreach ($pet in @('falcon', 'cat', 'robot', 'fire', 'penguin')) {
    $output = Join-Path $PSScriptRoot "source/$pet.png"
    if (Test-Path -LiteralPath $output) {
        Write-Output "SKIP existing $pet"
        continue
    }
    & $python $script $pet
    if ($LASTEXITCODE -ne 0) { throw "NAI failed for $pet with exit code $LASTEXITCODE" }
}
