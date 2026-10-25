// New expedition adapter is separate so the 3/9 and 6/9 public adapters remain frozen.
import { generateExplorationMap } from './map-generator-v7.js';
import { createCurrentLayeredMap } from './layeredMap.js';

export function createExplorationLayeredMap(seed=0){
  const generated=generateExplorationMap(seed);
  // Display names/colours belong to the existing layer presentation; never reuse its roads.
  const presentation=createCurrentLayeredMap(seed);
  return generated.layers.map((layer,li)=>({
    id:presentation[li].id,name:presentation[li].name,nameEn:presentation[li].nameEn,color:presentation[li].color,
    generatorVersion:generated.generatorVersion,layoutVersion:generated.layoutVersion,gridBounds:layer.gridBounds,
    nodes:layer.nodes,entrances:[layer.entry],entranceNames:[layer.nodes[layer.entry].name],
    doors:layer.doors||[],altarEntrances:layer.altarEntrances||[],exit:layer.exit,
    logical:layer.nodes.map(n=>({grid:[],fire:n.type==='fire',oldIdx:n.idx,
      def:{type:n.type,name:n.name,extraction:n.extraction},id:n.id,row:n.row,x:n.x,next:n.next})),
  }));
}
