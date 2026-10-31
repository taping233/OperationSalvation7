$ErrorActionPreference = 'Stop'
$evidenceRoot = $PSScriptRoot
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$roslynRoot = 'C:\Program Files\dotnet\sdk\8.0.424\Roslyn\bincore'
[System.Reflection.Assembly]::LoadFrom((Join-Path $roslynRoot 'Microsoft.CodeAnalysis.dll')) | Out-Null
[System.Reflection.Assembly]::LoadFrom((Join-Path $roslynRoot 'Microsoft.CodeAnalysis.CSharp.dll')) | Out-Null
$results = foreach ($file in Get-ChildItem -LiteralPath (Join-Path $workspace 'Assets/Scripts/Sdt.UI/Screens/Battle') -Filter '*.cs') {
    $tree = [Microsoft.CodeAnalysis.CSharp.CSharpSyntaxTree]::ParseText([System.IO.File]::ReadAllText($file.FullName), $null, $file.FullName, [System.Text.Encoding]::UTF8, [System.Threading.CancellationToken]::None)
    $diagnostics = @($tree.GetDiagnostics() | Where-Object Severity -eq 'Error' | ForEach-Object ToString)
    [PSCustomObject]@{ file = $file.Name; errors = $diagnostics }
}
$results | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'syntax-check.json') -Encoding utf8
$failed = @($results | Where-Object { $_.errors.Count -gt 0 })
[PSCustomObject]@{ parsedFiles = @($results).Count; errors = @($failed).Count; projectCompilation = $false } | ConvertTo-Json
if ($failed.Count -gt 0) { $failed | ConvertTo-Json -Depth 5; exit 1 }
