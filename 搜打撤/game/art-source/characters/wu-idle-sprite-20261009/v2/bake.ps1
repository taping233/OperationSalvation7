$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    New-Item -ItemType Directory -Force -Path 'frames' | Out-Null
    $breathY = 'Y+1.75*(1-cos(2*PI*N/72))*if(lt(Y,300),1,if(lt(Y,365),(1+cos(PI*(Y-300)/65))/2,0))'
    $breathFilter = "scale=720:480:flags=lanczos,pad=768:512:24:16:color=black@0,format=gbrap,geq=r='r(X,$breathY)':g='g(X,$breathY)':b='b(X,$breathY)':a='alpha(X,$breathY)',format=rgba"
    ffmpeg -hide_banner -loglevel error -y -loop 1 -framerate 24 -i 'base.png' -vf $breathFilter -frames:v 72 -start_number 0 'frames/idle-%03d.png'
    if ($LASTEXITCODE -ne 0) { throw 'Sprite bake failed' }
    python pack_sprite.py
    if ($LASTEXITCODE -ne 0) { throw 'Sprite packing failed' }
} finally { Pop-Location }
