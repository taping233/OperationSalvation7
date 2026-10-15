import { it, expect } from 'vitest';
import { V2_ART, splitV2Pixels, v2Pose } from '../game/src/hub/base-chibi-v2.art.js';
import * as helpers from '../game/src/hub/base-chibi-gait.js';
const length=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

it('keeps the setup painting coordinates intact at rest, including the neck joint',()=>{
  const pose=v2Pose({rest:true,time:10,distance:17,walk:1},helpers);
  for (const p of [V2_ART.neck,V2_ART.pivot,{x:500,y:580},{x:730,y:900}]) {
    expect(pose.head(p)).toEqual(p); expect(pose.torso(p)).toEqual(p);
  }
  for (const limb of [...pose.legs,...pose.arms]) expect(limb.points).toEqual(limb.rest);
});
it('partitions pixels into one owner and restores their RGBA values without a seam',()=>{
  const width=128,height=192,pixels=new Uint8ClampedArray(width*height*4);
  for (let i=0;i<pixels.length;i+=4) { pixels[i]=233; pixels[i+1]=190; pixels[i+2]=170; pixels[i+3]=(i/4)%251; }
  const result=splitV2Pixels(pixels,width,height);
  expect(result.mismatches).toBe(0);
  for (let i=0;i<pixels.length;i+=4) {
    const owner=result.names.filter(name=>result.output[name][i+3]);
    expect(owner).toHaveLength(pixels[i+3]?1:0);
  }
});
it('preserves leg and ankle lengths through a complete gait with a planted scene-space toe',()=>{
  const anchors=[null,null],cycles=[null,null];
  for (let d=29;d<58;d+=.1) {
    const pose=v2Pose({walk:1,distance:d},helpers);
    pose.legs.forEach((limb,index)=>{
      for (let bone=0;bone<3;bone++) expect(length(limb.points[bone],limb.points[bone+1])).toBeCloseTo(length(limb.rest[bone],limb.rest[bone+1]),5);
      if (!limb.planted) { anchors[index]=null; return; }
      const toe=limb.points[3],cycle=Math.floor(d/29+index*.5),world=d+toe.x*V2_ART.scale;
      if (anchors[index]!==null&&cycles[index]===cycle) expect(world).toBeCloseTo(anchors[index],6);
      anchors[index]=world; cycles[index]=cycle; expect(toe.y).toBe(limb.rest[3].y);
    });
  }
});
