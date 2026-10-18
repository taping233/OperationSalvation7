const spec=await (await fetch('sprite.json')).json(),canvas=document.querySelector('#stage'),ctx=canvas.getContext('2d'),status=document.querySelector('#status');
const images=await Promise.all(spec.frames.map(async f=>{const im=new Image();im.src=f.path;await im.decode();return im;}));
let frame=0,elapsed=0,last=0,playing=false,loop=false,speed=1;
function show(){const im=images[frame],f=spec.frames[frame],scale=Math.min(canvas.width/im.width,canvas.height/im.height);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(im,(canvas.width-im.width*scale)/2+(f.offsetX||0),(canvas.height-im.height*scale)/2+(f.offsetY||0),im.width*scale,im.height*scale);document.querySelector('#seek').value=frame;status.textContent=`${frame+1}/${images.length} · ${f.label}${frame===images.length-1?' · 倒地停留':''}`;document.body.dataset.frame=frame;document.body.dataset.ready='true';}
function start(){frame=0;elapsed=0;playing=true;show();}
document.querySelector('#play').onclick=()=>{loop=false;document.querySelector('#loop').textContent='循环演示';start();};
document.querySelector('#idle').onclick=()=>{loop=false;playing=false;frame=0;document.querySelector('#loop').textContent='循环演示';show();};
document.querySelector('#loop').onclick=()=>{loop=!loop;document.querySelector('#loop').textContent=loop?'停止循环':'循环演示';if(loop)start();};
document.querySelector('#next').onclick=()=>{playing=false;frame=(frame+1)%images.length;show();};
document.querySelector('#seek').oninput=e=>{playing=false;frame=Number(e.target.value);show();};
document.querySelector('#speed').onchange=e=>speed=Number(e.target.value);
for(const b of document.querySelectorAll('button'))b.disabled=false;
function tick(now){const dt=last?Math.min(now-last,100):0;last=now;if(playing){elapsed+=dt*speed;const duration=spec.frames[frame].durationMs;if(elapsed>=duration){elapsed-=duration;if(frame<images.length-1)frame++;else if(loop)frame=0;else playing=false;show();}}requestAnimationFrame(tick);}
show();start();requestAnimationFrame(tick);
