$ErrorActionPreference='Stop'
Push-Location $PSScriptRoot
try {
    $power='if(lte(N,4),sin(PI*N/8),(1+cos(PI*(N-4)/14))/2)'
    $mx="X+8*($power)*clip((420-Y)/300,0,1)"
    $my="Y-2*($power)*clip((420-Y)/260,0,1)"
    $filter="format=gbrap,geq=r='r($mx,$my)':g='g($mx,$my)':b='b($mx,$my)':a='alpha($mx,$my)',format=rgba"
    ffmpeg -hide_banner -loglevel error -y -loop 1 -framerate 24 -i 'idle/frames/idle-000.png' -vf $filter -frames:v 19 -start_number 0 'hurt/frame-%02d.png'
    if($LASTEXITCODE -ne 0){throw 'Hurt bake failed'}
    python pack_hurt_frames.py
    if($LASTEXITCODE -ne 0){throw 'Hurt export failed'}
} finally {Pop-Location}
