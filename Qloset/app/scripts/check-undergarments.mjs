import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {applyUndergarments,disposeUndergarments} from '../dist/undergarments.js';
import {createSurface} from '../dist/body-viewer.js';
import {PRESETS} from '../dist/measurements.js';
const root=new URL('../',import.meta.url);
const data=JSON.parse(await readFile(new URL('dist/body.json',root),'utf8'));
const checks=JSON.parse(await readFile(new URL('.sites-runtime/model-check.json',root),'utf8'));
const results=[],meshes=[];
const surface=createSurface(data.indices,data.positions.length/3),reference=new Float32Array(surface.count*3);surface.apply(data.positions,reference);
function area(positions,indices){
 let total=0;
 for(let i=0;i<indices.length;i+=3){
   const [a,b,c]=indices.slice(i,i+3).map(v=>v*3);
   const u=[0,1,2].map(k=>positions[b+k]-positions[a+k]),v=[0,1,2].map(k=>positions[c+k]-positions[a+k]);
   total+=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2;
 }
 return total;
}
function checkConnectedGarments(topology){
 const adjacency=Array.from({length:topology.count},()=>[]);
 for(let i=0;i<topology.clothing.length;i+=3){
   const[a,b,c]=topology.clothing.slice(i,i+3);
   for(const[x,y]of[[a,b],[b,c],[c,a]]){adjacency[x].push(y);adjacency[y].push(x);}
 }
 const seen=new Set();let components=0;
 for(const v of topology.clothing){
   if(seen.has(v))continue;components++;const todo=[v];
   while(todo.length){const i=todo.pop();if(seen.has(i))continue;seen.add(i);for(const j of adjacency[i])if(!seen.has(j))todo.push(j);}
 }
 assert.equal(components,2,'The bralette (including both straps) and briefs must each be connected.');
 const degree=new Map();for(const edge of topology.edges)for(const i of edge)degree.set(i,(degree.get(i)||0)+1);
 assert([...degree.values()].every(n=>n===2),'Every sewing line must form a closed loop with no loose ends.');
}
for(const model of checks.meshes){
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(model.positions,3));geometry.setIndex(model.indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
 const original=Array.from(geometry.attributes.position.array),originalIndices=Array.from(geometry.index.array);
 const viewer={data,geometry,surface,mesh:new THREE.Mesh(geometry),bodyGroup:new THREE.Group(),bodyHeight:Math.max(...model.positions.filter((_,i)=>i%3===1))};
 const gender=PRESETS.find(p=>p.name===model.name).gender;
 applyUndergarments(viewer,gender);
 const g=viewer.garments;
 if(gender==='female')assert(g.topology.topFaces>500&&g.topology.briefsFaces>500,'Female profiles keep a bralette and briefs.');
 else assert(g.topology.topFaces===0&&g.topology.shortsFaces>500,'Male profiles keep shorts without a base top.');
 assert.equal(g.material.transparent,false);assert.equal(g.material.opacity,1);
 assert.deepEqual(Array.from(geometry.attributes.position.array),original,'Measurements must retain original body geometry.');
 assert.deepEqual(Array.from(geometry.index.array),originalIndices,'Full measurement topology must remain intact.');
 const cutReference=Array.from(reference);
 for(const {a,b,t} of g.topology.bindings||[])for(let k=0;k<3;k++)cutReference.push(cutReference[a*3+k]+(cutReference[b*3+k]-cutReference[a*3+k])*t);
 const originalArea=area(reference,originalIndices),partitionArea=area(cutReference,g.topology.skin)+area(cutReference,g.topology.clothing);
 assert(Math.abs(originalArea-partitionArea)<originalArea*1e-6,'Skin and fabric must cover the complete surface, including clipped seams.');
 let exposedChest=0;
 for(const [faces,isFabric] of [[g.topology.skin,false],[g.topology.clothing,true]])for(let i=0;i<faces.length;i+=3){
   const face=faces.slice(i,i+3),center=[0,1,2].map(axis=>face.reduce((s,j)=>s+cutReference[j*3+axis],0)/3);
   const chest=center[1]>.70&&center[1]<.735&&Math.abs(center[0])<.07;
   const pelvis=center[1]>.51&&center[1]<.55&&Math.abs(center[0])<.02;
   if(chest){assert.equal(isFabric,gender==='female',`${model.name}: chest coverage follows the profile`);if(!isFabric)exposedChest++;}
   if(pelvis)assert(isFabric,`${model.name}: pelvis remains clothed`);
   if(gender==='male'&&isFabric)assert(center[1]<.59,'Male fabric stays below the waist.');
 }
 if(gender==='male')assert(exposedChest>500,'Removing the male top restores chest skin, not an empty hole.');
 const black=color=>color.r===color.g&&color.g===color.b&&color.r<.02;
 if(g.fabric.attributes.color){const colors=g.fabric.attributes.color.array;for(let i=0;i<colors.length;i+=3)assert(black({r:colors[i],g:colors[i+1],b:colors[i+2]}),'Base fabric and bands are black.');}
 else assert(black(g.material.color),'Base shorts are black.');
 if(gender==='female')checkConnectedGarments(g.topology);
 for(const geo of[g.fabric,g.skin])for(const name of['position','normal'])assert(Array.from(geo.attributes[name].array).every(Number.isFinite));
 for(const edge of g.topology.edges)for(const i of edge)for(let axis=0;axis<3;axis++)assert.equal(g.skin.attributes.position.array[i*3+axis],g.fabric.attributes.position.array[i*3+axis],'Skin and fabric must meet without gaps.');
 results.push({profile:model.name,gender,exposedChest,topFaces:g.topology.topFaces,bottomFaces:g.topology.briefsFaces||g.topology.shortsFaces,black:true,opaque:true});
 meshes.push({...model,positions:Array.from(viewer.mesh.geometry.attributes.position.array),indices:Array.from(viewer.mesh.geometry.index.array),garment:{positions:Array.from(g.fabric.attributes.position.array),indices:Array.from(g.fabric.index.array),normals:Array.from(g.fabric.attributes.normal.array)}});
 applyUndergarments(viewer,gender);assert.equal(viewer.garments,g,'Body updates reuse the fitted topology.');
 const other=gender==='female'?'male':'female';applyUndergarments(viewer,other);assert.equal(viewer.garments.gender,other);assert.notEqual(viewer.garments,g,'Changing gender replaces the default garment set.');
 applyUndergarments(viewer,gender);assert.equal(viewer.garments.gender,gender);
 disposeUndergarments(viewer);assert.equal(viewer.garments,null);assert.equal(viewer.bodyGroup.children.length,0);
}
await writeFile(new URL('.sites-runtime/garment-check.json',root),JSON.stringify({meshes}));
console.log(JSON.stringify(results,null,2));
