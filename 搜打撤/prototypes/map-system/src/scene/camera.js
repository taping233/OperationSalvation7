import { T } from './primitives.js';
import { UNIT } from './map-scene.js';
class MapCamera {
  constructor(map,w,h){this.map=map;this.viewW=w;this.viewH=h;this.cx=720;this.cy=720;this.zoom=1;this.angle=-.65;this.camera=new T.OrthographicCamera();this.ray=new T.Raycaster();this.plane=new T.Plane(new T.Vector3(0,1,0),-.2);}
  resize(w,h){this.viewW=w;this.viewH=h;this.sync();}
  sync(){const span=32/this.zoom,aspect=this.viewW/Math.max(1,this.viewH);Object.assign(this.camera,{left:-span*aspect/2,right:span*aspect/2,top:span/2,bottom:-span/2,near:.1,far:150});const x=this.cx*UNIT,z=this.cy*UNIT;this.camera.position.set(x+Math.sin(this.angle)*24,30,z+Math.cos(this.angle)*24);this.camera.lookAt(x,0,z);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();}
  screenToWorld(x,y){this.sync();this.ray.setFromCamera(new T.Vector2(x/this.viewW*2-1,1-y/this.viewH*2),this.camera);const p=new T.Vector3();this.ray.ray.intersectPlane(this.plane,p);return {x:p.x/UNIT,y:p.z/UNIT};}
  panBy(dx,dy){const a=this.screenToWorld(this.viewW/2,this.viewH/2),b=this.screenToWorld(this.viewW/2+dx,this.viewH/2+dy);this.cx-=b.x-a.x;this.cy-=b.y-a.y;this.clamp();}
  zoomAt(x,y,f){const a=this.screenToWorld(x,y);this.zoom=Math.max(.65,Math.min(3.2,this.zoom*f));const b=this.screenToWorld(x,y);this.cx+=a.x-b.x;this.cy+=a.y-b.y;this.clamp();}
  clamp(){if(this.zoom<=1.15){this.cx=720;this.cy=720;return;}this.cx=Math.max(-120,Math.min(1560,this.cx));this.cy=Math.max(-120,Math.min(1560,this.cy));}
}
export { MapCamera };
