$ErrorActionPreference='Stop'
Push-Location $PSScriptRoot
try {
    New-Item -ItemType Directory -Force -Path 'idle/frames' | Out-Null
    $breathY='Y+1.5*(1-cos(2*PI*N/72))*sin(PI*clip((X-340)/160,0,1))*if(gt(Y,135),if(lt(Y,250),sin(PI*(Y-135)/115),0),0)'
    $filter="scale=720:480:flags=lanczos,pad=768:512:24:16:color=black@0,format=gbrap,geq=r='r(X,$breathY)':g='g(X,$breathY)':b='b(X,$breathY)':a='alpha(X,$breathY)',format=rgba"
    ffmpeg -hide_banner -loglevel error -y -loop 1 -framerate 24 -i 'base.png' -vf $filter -frames:v 72 -start_number 0 'idle/frames/idle-%03d.png'
    if($LASTEXITCODE -ne 0){throw 'Idle bake failed'}
    python pack_idle.py
    if($LASTEXITCODE -ne 0){throw 'Idle packing failed'}
} finally {Pop-Location}
