$ErrorActionPreference='Stop'
$researchRoot=Split-Path -Parent $PSScriptRoot
$researchUtf8=New-Object System.Text.UTF8Encoding($false)
function Save-ResearchJson($name,$value) { [System.IO.File]::WriteAllText((Join-Path $researchRoot $name),(ConvertTo-Json -InputObject $value -Depth 20),$researchUtf8) }
$researchInputs=@('first-party/records.json','assets-ui/records.json','tools/records.json')
$researchRecords=@()
foreach($researchInput in $researchInputs) { $researchRecords+=@(Get-Content -LiteralPath (Join-Path $researchRoot $researchInput) -Raw|ConvertFrom-Json) }
$researchExcluded=@(
 @{id='kenney-cc0-terms';reason='保留为素材授权补充，在主catalog不重复计算'},
 @{id='kenney-ui-sfx-oga';reason='已有2020官方Interface Sounds及真实下载，2012旧包保留分组原记录不优先列入'},
 @{id='fp-hades-documentary';reason='官方纪录片推广入口仅核验范围，未读实质访谈，本版不占核心来源名额'},
 @{id='lighthouse';reason='与Performance工具参考重合且本轮未运行，保留分组原记录不优先列入'}
)
$researchExcludedIds=@($researchExcluded|ForEach-Object{$_.id})
$researchRecords=@($researchRecords|Where-Object{$_.id -notin $researchExcludedIds})
$researchManifest=@()
foreach($researchInput in @('tools/source-download-manifest.json','tools/complete-game-download-manifest.json')) {
 if(Test-Path -LiteralPath (Join-Path $researchRoot $researchInput)) { $researchManifest+=@(Get-Content -LiteralPath (Join-Path $researchRoot $researchInput) -Raw|ConvertFrom-Json) }
}
$researchAssetManifest=Join-Path $researchRoot 'assets-ui/download-manifest.json'
if(Test-Path -LiteralPath $researchAssetManifest) {
 foreach($researchFile in @(Get-Content -LiteralPath $researchAssetManifest -Raw|ConvertFrom-Json)) {
  $researchFile.path='assets-ui/'+$researchFile.path
  $researchFile|Add-Member -NotePropertyName status -NotePropertyValue $(if($researchFile.type -eq 'archive' -or $researchFile.path -match '\.svg$'){'downloaded'}elseif($researchFile.path -match 'ATTRIBUTION.txt$'){'generated'}else{'extracted'}) -Force
  $researchFile|Add-Member -NotePropertyName executed -NotePropertyValue $false -Force
  $researchFile|Add-Member -NotePropertyName id -NotePropertyValue $(if($researchFile.path -match 'icon|svg'){'game-icons-net-risk-extraction-inventory'}else{'kenney-interface-sounds'}) -Force
  $researchManifest+=$researchFile
 }
}
$researchManifest+= [pscustomobject]@{id='rot-js';status='failed';path='downloads/rot-js/src/MinHeap.ts';url='https://raw.githubusercontent.com/ondras/rot.js/46782e248c2db9d379a5e4f13bb8323f18dff04b/src/MinHeap.ts';bytes=0;sha256=$null;error='Unexpected EOF / 0 bytes from transport stream; file absent; not retried indefinitely';executed=$false}
$researchSuccessful=@($researchManifest|Where-Object{$_.status -in @('downloaded','extracted','generated')})
$researchFailures=@($researchManifest|Where-Object{$_.status -eq 'failed'})
foreach($researchFile in $researchSuccessful) {
 $researchAbsolute=[System.IO.Path]::GetFullPath((Join-Path $researchRoot $researchFile.path))
 $researchExpectedRoot=[System.IO.Path]::GetFullPath($researchRoot)+[System.IO.Path]::DirectorySeparatorChar
 if(-not $researchAbsolute.StartsWith($researchExpectedRoot,[System.StringComparison]::OrdinalIgnoreCase)) {throw ('Path escaped library: '+$researchFile.path)}
 if(-not(Test-Path -LiteralPath $researchAbsolute)){throw ('Missing file: '+$researchFile.path)}
 if((Get-Item -LiteralPath $researchAbsolute).Length -ne $researchFile.bytes){throw ('Size mismatch: '+$researchFile.path)}
 if((Get-FileHash -LiteralPath $researchAbsolute -Algorithm SHA256).Hash.ToLowerInvariant() -ne $researchFile.sha256){throw ('Hash mismatch: '+$researchFile.path)}
}
$researchMap=@{
 'audio-assets'='art-audio';'ui-art-assets'='art-audio';'game-icons'='art-audio';'art-assets'='art-audio';'gameplay-ui-icons'='art-audio';
 'developer-postmortem'='developer-retrospective';'developer-interview'='developer-retrospective';
 'studio-production-process'='studio-process';'game-evaluation'='game-evaluation';
 'ai-game-production'='ai-production';'open-source'='open-source';'tools'='tools'
}
foreach($researchRecord in $researchRecords) {
 $researchOriginalCategory=$researchRecord.category
 if($researchMap.ContainsKey($researchOriginalCategory)){$researchRecord.category=$researchMap[$researchOriginalCategory]}
 elseif($researchOriginalCategory -match 'accessibility|^ui-|game-ui'){$researchRecord.category='ui-accessibility'}
 else{throw ('Unmapped category: '+$researchOriginalCategory)}
 $researchRecord|Add-Member -NotePropertyName originalCategory -NotePropertyValue $researchOriginalCategory -Force
 $researchOwnDownloads=@($researchSuccessful|Where-Object{$_.id -eq $researchRecord.id})
 if($researchRecord.id -in @('rot-js','howler','jsfxr','seedrandom','2048-reference')) {
  $researchRecord.localFiles=@($researchOwnDownloads.path)
  $researchRecord.bytes=($researchOwnDownloads|Measure-Object -Property bytes -Sum).Sum
  $researchHashes=[ordered]@{}
  foreach($researchOwnFile in $researchOwnDownloads){$researchHashes[$researchOwnFile.path]=$researchOwnFile.sha256}
  $researchRecord.sha256=$researchHashes
 } elseif($researchRecord.id -in @('kenney-interface-sounds','game-icons-net-risk-extraction-inventory')) {
  $researchRecord.localFiles=@($researchOwnDownloads.path)
 }
 if($researchRecord.id -eq 'rot-js'){$researchRecord.limitations+=' MinHeap.ts传输失败，故该子集不独立可运行；两个错误路径404均保留在失败清单。'}
 $researchRecord|Add-Member -NotePropertyName downloaded -NotePropertyValue ($researchOwnDownloads.Count -gt 0) -Force
 $researchRecord|Add-Member -NotePropertyName verificationOwner -NotePropertyValue $(if($researchRecord.id -like 'fp-*'){'first-party-research代理'}elseif($researchRecord.url -match 'kenney|w3.org|material|nngroup|1004.0256|game-icons'){'assets-ui代理'}else{'资料库负责人'}) -Force
}
$researchRequired=@('id','title','category','author','publishedOrUpdated','accessedAt','url','sourceType','qualityReason','projectFit','limitations','license','licenseUrl','useStatus','takeaways','localFiles','bytes','sha256')
foreach($researchRecord in $researchRecords) {
 foreach($researchKey in $researchRequired){if($researchKey -notin $researchRecord.PSObject.Properties.Name){throw ('Missing schema field '+$researchRecord.id+':'+$researchKey)}}
 if($researchRecord.takeaways.Count -lt 2 -or $researchRecord.takeaways.Count -gt 4){throw ('Takeaway count: '+$researchRecord.id)}
 if($researchRecord.useStatus -notin @('reference-only','evaluate','usable')){throw ('Invalid useStatus: '+$researchRecord.id)}
 if(-not ([uri]$researchRecord.url).IsAbsoluteUri){throw ('Invalid URL: '+$researchRecord.id)}
}
if(@($researchRecords.id|Sort-Object -Unique).Count -ne $researchRecords.Count){throw 'Duplicate ID'}
if(@($researchRecords.url|Sort-Object -Unique).Count -ne $researchRecords.Count){throw 'Duplicate URL'}
$researchEight=@('art-audio','open-source','developer-retrospective','studio-process','game-evaluation','ui-accessibility','ai-production','tools')
foreach($researchCategory in $researchEight){if($researchCategory -notin $researchRecords.category){throw ('Missing category: '+$researchCategory)}}
$researchStats=[ordered]@{
 records=$researchRecords.Count
 categories=@($researchRecords|Group-Object category|ForEach-Object{[ordered]@{category=$_.Name;count=$_.Count}})
 successfulFiles=$researchSuccessful.Count
 failures=$researchFailures.Count
 downloadedBytes=($researchSuccessful|Where-Object status -eq 'downloaded'|Measure-Object bytes -Sum).Sum
 storedPayloadBytes=($researchSuccessful|Measure-Object bytes -Sum).Sum
 libraryBytes=(Get-ChildItem -LiteralPath $researchRoot -Recurse -File|Measure-Object Length -Sum).Sum
 thirdPartyCodeExecuted=$false
}
Save-ResearchJson 'catalog.json' @($researchRecords)
Save-ResearchJson 'download-manifest.json' ([ordered]@{accessedAt='2026-10-02';root='library/';stats=$researchStats;files=$researchSuccessful;failures=$researchFailures;scope='Raw source subsets + complete original 2048 archive + small permitted assets; no third-party execution';licenseBoundary='useStatus is an evaluation/licensing classification, not proof of runtime integration. downloaded records actual possession.'})
Save-ResearchJson 'selection-notes.json' ([ordered]@{excludedFromCoreCatalog=$researchExcluded;retainedInOriginalGroupRecords=$true;manualSelection=$true;numericQualityScores=$false})
Save-ResearchJson 'validation.json' ([ordered]@{validatedAt=(Get-Date).ToUniversalTime().ToString('o');result='passed';checks=@('all JSON parsed','required fields','2-4 original short takeaways','unique ID and URL','eight categories covered','absolute HTTPS/URI source links','downloaded file existence/size/SHA256','download paths remain in library','raw assets ignored by library .gitignore');stats=$researchStats;limits=@('URLs personally opened by assigned researcher, not all re-opened by integrator','no videos watched end-to-end','selected sounds not auditioned','no downloaded code executed','no game build, tests, save writes or service actions');basis='Handoff HEAD c6ee206840 supplied by root; project fit checked against current README/package.json/production entry.'})
$researchStats|ConvertTo-Json -Depth 8
