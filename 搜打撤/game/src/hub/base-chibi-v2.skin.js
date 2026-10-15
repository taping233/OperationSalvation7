import { V2_ART, splitV2Pixels, v2Pose } from './base-chibi-v2.art.js';
import { footTarget, solveTwoBone, smooth, mix, skinVertex } from './base-chibi-gait.js';

function connectedLimb(pixels,width,height) {
  const count=width*height,seen=new Uint8Array(count),queue=new Int32Array(count);
  let largest=[];
  for (let first=0;first<count;first++) {
    if (seen[first]||pixels[first*4+3]<64) continue;
    let read=0,write=1; queue[0]=first; seen[first]=1;
    while (read<write) {
      const at=queue[read++],x=at%width,y=Math.floor(at/width);
      for (const next of [x?at-1:-1,x+1<width?at+1:-1,y?at-width:-1,y+1<height?at+width:-1]) {
        if (next<0||seen[next]||pixels[next*4+3]<64) continue;
        seen[next]=1; queue[write++]=next;
      }
    }
    if (write>largest.length) largest=Array.from(queue.subarray(0,write));
  }
  const keep=new Uint8Array(count); for (const at of largest) keep[at]=1;
  for (let at=0;at<count;at++) if (!keep[at]) {
    const x=at%width,y=Math.floor(at/width);
    const edge=pixels[at*4+3]<64&&((x&&keep[at-1])||(x+1<width&&keep[at+1])||(y&&keep[at-width])||(y+1<height&&keep[at+width]));
    if (!edge) pixels.fill(0,at*4,at*4+4);
  }
  return pixels;
}

function layerTexture(pixi, pixels, width, height, ratio) {
  let left=width, top=height, right=0, bottom=0;
  for (let y=0;y<height;y++) for (let x=0;x<width;x++) if (pixels[(y*width+x)*4+3]) {
    left=Math.min(left,x); top=Math.min(top,y); right=Math.max(right,x+1); bottom=Math.max(bottom,y+1);
  }
  left=Math.max(0,left-2); top=Math.max(0,top-2); right=Math.min(width,right+2); bottom=Math.min(height,bottom+2);
  const canvas=document.createElement('canvas'); canvas.width=right-left; canvas.height=bottom-top;
  const context=canvas.getContext('2d'), data=context.createImageData(canvas.width,canvas.height);
  for (let y=top;y<bottom;y++) data.data.set(pixels.subarray((y*width+left)*4,(y*width+right)*4),(y-top)*canvas.width*4);
  context.putImageData(data,0,0);
  return { texture:new pixi.Texture(new pixi.BaseTexture(canvas)), box:{x:left/ratio,y:top/ratio,width:canvas.width/ratio,height:canvas.height/ratio} };
}

function meshFor(pixi, texture, box, columns=8, rows=24) {
  const vertices=new Float32Array((columns+1)*(rows+1)*2), uvs=new Float32Array(vertices.length), indices=[], source=[];
  for (let y=0;y<=rows;y++) for (let x=0;x<=columns;x++) {
    const index=y*(columns+1)+x;
    source.push({x:box.x+x/columns*box.width,y:box.y+y/rows*box.height});
    uvs[index*2]=x/columns; uvs[index*2+1]=y/rows;
    if (x<columns&&y<rows) { const a=index,b=a+1,c=a+columns+1,d=c+1; indices.push(a,b,c,b,d,c); }
  }
  const mesh=new pixi.SimpleMesh(texture,vertices,uvs,new Uint16Array(indices),pixi.DRAW_MODES.TRIANGLES);
  mesh.canvasPadding=1;
  return { mesh, update(map) {
    for (let index=0;index<source.length;index++) {
      const p=map(source[index]); vertices[index*2]=p.x*V2_ART.scale; vertices[index*2+1]=p.y*V2_ART.scale+V2_ART.y;
    }
    mesh.geometry.getBuffer('aVertexPosition').update();
  } };
}

function deformLimb(p, limb, torso, attach=true) {
  const [root,knee,ankle] = limb.rest;
  const upper=1-smooth(knee.y-45,knee.y+45,p.y), end=smooth(ankle.y-30,ankle.y+30,p.y);
  const transformed=skinVertex(p,limb.rest,limb.points,[upper,1-upper-end,end]);
  if (!attach) return transformed;
  // The attachment boundary at the shoulder/hip stays on the parent surface.
  const binding=smooth(root.y+8,root.y+35,p.y), parent=torso(p);
  return {x:mix(parent.x,transformed.x,binding),y:mix(parent.y,transformed.y,binding)};
}

export async function createV2Skin(host) {
  const image=host.querySelector('.chibi-v2-source');
  const repairs=await Promise.all(['body-underpaint','legs-underpaint'].map(async name=>{
    const item=new Image(); item.src=new URL(`../../assets/chibi/wu-v2/${name}.webp`,import.meta.url).href;
    await item.decode(); return item;
  }));
  await image.decode();
  if (!host.isConnected) return null;
  let pixi=await import('pixi.js');
  if (!pixi.utils.isWebGLSupported()) pixi=await import('pixi.js-legacy');
  if (!host.isConnected) return null;
  const master=document.createElement('canvas'); master.width=image.naturalWidth; master.height=image.naturalHeight;
  const context=master.getContext('2d'); context.drawImage(image,0,0);
  const pixels=context.getImageData(0,0,master.width,master.height);
  const split=splitV2Pixels(pixels.data,master.width,master.height);
  if (split.mismatches) throw new Error('分层复原未通过');
  host.dataset.rebuildMismatches=String(split.mismatches);
  host.dataset.sourcePixels=String(split.opaque);
  const textures={}, items={};
  const repairPixels=repairs.map(repair=>{
    if (repair.naturalWidth!==master.width||repair.naturalHeight!==master.height) throw new Error('补绘画布与基准不一致');
    context.clearRect(0,0,master.width,master.height); context.drawImage(repair,0,0);
    return context.getImageData(0,0,master.width,master.height).data;
  });
  const bodyFill=new Uint8ClampedArray(pixels.data.length);
  const legFill=[new Uint8ClampedArray(split.output.legFront),new Uint8ClampedArray(split.output.legBack)];
  for (let y=0;y<master.height;y++) for (let x=0;x<master.width;x++) {
    const at=(y*master.width+x)*4,px=x/split.ratio,py=y/split.ratio;
    if (py<1080 && (split.output.armFront[at+3]||split.output.armBack[at+3])) bodyFill.set(repairPixels[0].subarray(at,at+4),at);
    const side=px<615?0:1,part=legFill[side];
    const missing=!part[at+3]&&py>995&&py<1300&&px>440&&px<710;
    const skirtTip=side===0&&px>=584&&px<=625&&py>=1080&&py<=1140;
    if ((missing||skirtTip)&&repairPixels[1][at+3]) {
      const color=repairPixels[1].subarray(at,at+4);
      if (color[0]>color[1]+8&&color[1]>color[2]+5) part.set(color,at);
    }
  }
  split.output.bodyFill=bodyFill;
  split.output.legFrontFill=connectedLimb(legFill[0],master.width,master.height);
  split.output.legBackFill=connectedLimb(legFill[1],master.width,master.height);
  const app=new pixi.Application({width:170,height:240,resolution:3,autoDensity:true,backgroundAlpha:0,
    antialias:true,autoStart:false,sharedTicker:false,forceCanvas:!pixi.utils.isWebGLSupported()});
  app.view.className='chibi-skin'; app.view.setAttribute('aria-hidden','true'); app.stage.position.set(10,20);
  for (const name of [...split.names,'bodyFill','legFrontFill','legBackFill']) {
    const part=layerTexture(pixi,split.output[name],master.width,master.height,split.ratio);
    textures[name]=part.texture;
    items[name]=meshFor(pixi,part.texture,part.box,name==='core'?16:8,name==='weapon'?1:28);
  }
  app.stage.addChild(items.hair.mesh,items.weapon.mesh,items.bodyFill.mesh,items.armBack.mesh,
    items.legBack.mesh,items.legBackFill.mesh,items.legFront.mesh,items.legFrontFill.mesh,items.core.mesh,items.armFront.mesh);
  host.querySelector('.chibi-scale').append(app.view);
  let disposed=false;
  function render(options={}) {
    if (disposed) return;
    const pose=v2Pose(options,{footTarget,solveTwoBone,smooth,mix});
    items.core.update(p=>{
      const next=pose.head(p), skirt=smooth(840,1090,p.y)*(1-smooth(1100,1200,p.y));
      next.x+=pose.skirt*skirt; return next;
    });
    items.weapon.update(pose.torso);
    items.bodyFill.update(pose.torso); items.bodyFill.mesh.visible=!options.rest;
    items.hair.update(p=>{ const next=pose.head(p); next.x+=smooth(400,1280,p.y)*pose.hair; return next; });
    for (const [name,index] of [['legFront',0],['legBack',1]]) {
      const moving=!options.rest&&options.walk>.001;
      for (const key of [name,name+'Fill']) items[key].update(p=>deformLimb(p,pose.legs[index],pose.torso,false));
      items[name].mesh.visible=!moving; items[name+'Fill'].mesh.visible=moving;
    }
    for (const [name,index] of [['armFront',0],['armBack',1]]) items[name].update(p=>deformLimb(p,pose.arms[index],pose.torso));
    app.render();
    host.dataset.skinPhase=String(pose.phase);
    host.dataset.frontFoot=pose.legs[0].points[3].x.toFixed(3)+','+pose.legs[0].points[3].y.toFixed(3);
    host.dataset.backFoot=pose.legs[1].points[3].x.toFixed(3)+','+pose.legs[1].points[3].y.toFixed(3);
    host.dataset.frontPlanted=String(pose.legs[0].planted); host.dataset.backPlanted=String(pose.legs[1].planted);
  }
  render({rest:true}); host.dataset.skin='true';
  return { render, dispose() {
    if (disposed) return; disposed=true;
    app.destroy(true,{children:true,texture:false,baseTexture:false});
    for (const texture of Object.values(textures)) texture.destroy(true);
  } };
}
