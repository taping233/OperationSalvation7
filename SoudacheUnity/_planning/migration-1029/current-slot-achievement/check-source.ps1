# Read-only Roslyn syntax and semantic diagnostics. No assembly emission, Unity process, or shared build output.
$ErrorActionPreference='Stop'
$projectRoot=(Resolve-Path "$PSScriptRoot/../../..").Path
$roslynRoot='D:/Unity/6000.6.7f1/Editor/Data/DotNetSdk/sdk/8.0.318/Roslyn/bincore'
Add-Type -Path "$roslynRoot/Microsoft.CodeAnalysis.dll"
Add-Type -Path "$roslynRoot/Microsoft.CodeAnalysis.CSharp.dll"
$options=[Microsoft.CodeAnalysis.CSharp.CSharpParseOptions]::Default.WithLanguageVersion([Microsoft.CodeAnalysis.CSharp.LanguageVersion]::CSharp9)
$trees=[Microsoft.CodeAnalysis.SyntaxTree[]]@(Get-ChildItem -LiteralPath "$projectRoot/Assets/Scripts" -Filter '*.cs' -Recurse | ForEach-Object {[Microsoft.CodeAnalysis.CSharp.CSharpSyntaxTree]::ParseText([IO.File]::ReadAllText($_.FullName),$options,$_.FullName)})
$engine=@(Get-ChildItem 'D:/Unity/6000.6.7f1/Editor/Data/Managed/UnityEngine' -Filter '*.dll')
$system=@(Get-ChildItem 'D:/Unity/6000.6.7f1/Editor/Data/DotNetSdk/packs/Microsoft.NETCore.App.Ref' -Filter 'System.Runtime.dll' -Recurse | Where-Object FullName -like '*net8.0*' | Select-Object -First 1 | ForEach-Object {Get-ChildItem $_.Directory -Filter '*.dll'})
$ui=Get-Item "$projectRoot/Library/ScriptAssemblies/UnityEngine.UI.dll"
$json=Get-ChildItem "$projectRoot/Library/PackageCache" -Filter 'Newtonsoft.Json.dll' -Recurse | Select-Object -First 1
$refs=[Microsoft.CodeAnalysis.MetadataReference[]]@(@($engine)+@($system)+@($ui)+@($json) | ForEach-Object {[Microsoft.CodeAnalysis.MetadataReference]::CreateFromFile($_.FullName)})
$settings=[Microsoft.CodeAnalysis.CSharp.CSharpCompilationOptions]::new([Microsoft.CodeAnalysis.OutputKind]::DynamicallyLinkedLibrary)
$analysis=[Microsoft.CodeAnalysis.CSharp.CSharpCompilation]::Create('CurrentArchiveReadOnly',$trees,$refs,$settings)
$errors=@($analysis.GetDiagnostics() | Where-Object { $_.Severity -eq 'Error' -and $_.Location.SourceTree.FilePath.Replace([char]92,[char]47) -match '/(Screens/Menu/(Current(Archive|Slot|Achievement)[^/]*|SlotPickerScreen|MenuDialogs)|Sdt.Res/CurrentArchiveAssets)\.cs$' } | ForEach-Object {$_.ToString()})
$audited=@($trees | Where-Object { $_.FilePath.Replace([char]92,[char]47) -match '/(Screens/Menu/(Current(Archive|Slot|Achievement)[^/]*|SlotPickerScreen|MenuDialogs)|Sdt.Res/CurrentArchiveAssets)\.cs$' } | ForEach-Object {$_.FilePath})
$warnings=@($analysis.GetDiagnostics() | Where-Object { $_.Severity -eq 'Warning' -and $audited -contains $_.Location.SourceTree.FilePath } | ForEach-Object {$_.ToString()})
$result=[ordered]@{auditedPaths=$audited;time=(Get-Date).ToString('o');mode='read-only Roslyn parse and GetDiagnostics; no Emit/build/Unity';sourceFiles=$trees.Count;archiveErrors=$errors;archiveWarnings=$warnings;nativeVerified=$false}
$result | ConvertTo-Json -Depth 6 | Set-Content "$PSScriptRoot/source-diagnostics.json" -Encoding utf8
if($errors.Count){$errors;exit 1}else{"Current archive syntax and semantic diagnostics: $($errors.Count) errors, $($warnings.Count) warnings"}
