import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const geometries = new Map(), materials = new Map();
function geometry(kind = 'box') {
  if (!geometries.has(kind)) geometries.set(kind, kind === 'sphere' ? new T.SphereGeometry(1, 10, 8) : kind === 'cone' ? new T.ConeGeometry(1, 1, 6) : kind === 'cylinder' ? new T.CylinderGeometry(1, 1, 1, 10) : new T.BoxGeometry(1,1,1));
  return geometries.get(kind);
}
function material(color) {
  if (!materials.has(color)) materials.set(color, new T.MeshLambertMaterial({color, flatShading:true}));
  return materials.get(color);
}
function part(parent, color, pos, size, kind='box') {
  const mesh = new T.Mesh(geometry(kind), material(color));
  mesh.position.set(...pos); mesh.scale.set(...size); parent.add(mesh); return mesh;
}
function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const batches = new Map();
  group.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (!batches.has(o.material)) batches.set(o.material, []);
    batches.get(o.material).push(g);
  });
  const result = new T.Group();
  for (const [mat, list] of batches) {
    const merged = mergeGeometries(list, false);
    const mesh = new T.Mesh(merged, mat); mesh.userData.ownedGeometry=true; result.add(mesh);
    list.forEach(g=>g.dispose());
  }
  return result;
}
function disposeScene(root) {
  root.traverse(o => { if (o.userData.ownedGeometry) o.geometry?.dispose(); });
  root.clear();
}
export { T, part, geometry, material, mergeStatic, disposeScene };
