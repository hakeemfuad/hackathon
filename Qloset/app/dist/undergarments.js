import * as THREE from './vendor/three.module.js';

const FABRIC_COLOR=0x171717,BAND_COLOR=0x111111,TRIM_COLOR=0x303030;
const clamp01=value=>Math.max(0,Math.min(1,value));
const smoothstep=(a,b,value)=>{const t=clamp01((value-a)/(b-a));return t*t*(3-2*t);};

// Reference-space cutting patterns stay attached to the same anatomy through
// every body morph. Positive values describe opaque fabric.
function femalePattern(x,y,z,arm){
 const ax=Math.abs(x),front=smoothstep(-.008,.044,z);
 const neckline=.747+front*(.018+.013*Math.min(ax/.074,1)**2);
 const panel=Math.min(y-.673,neckline-y,(.5-arm)*.05);
 const strapX=.071+.005*smoothstep(.765,.825,y);
 const straps=Math.min(y-.735,.842-y,.0048-Math.abs(ax-strapX),(.75-arm)*.05);
 const waist=.575+.010*Math.min(ax/.105,1)**2;
 const frontLeg=.455+.091*Math.min(ax/.115,1.2)**1.15;
 const backLeg=.449+.082*Math.min(ax/.12,1.2)**1.8;
 const leg=backLeg+(frontLeg-backLeg)*front;
 const briefs=Math.min(waist-y,y-leg,(.1-arm)*.05);
 return Math.max(panel,straps,briefs);
}

function referenceSurface(viewer){
 const count=viewer.geometry.attributes.position.count;
 const reference=new Float32Array(count*3),weights=new Float32Array(count*3);
 const source=viewer.data.positions,sourceWeights=new Float32Array(source.length);
 for(let i=0;i<source.length/3;i++)sourceWeights[i*3]=viewer.data.armWeights?.[i]||0;
 if(viewer.surface){viewer.surface.apply(source,reference);viewer.surface.apply(sourceWeights,weights);}
 else{reference.set(source);weights.set(sourceWeights);}
 return {reference,weights};
}

// Clip triangles at the sewing lines rather than selecting whole faces. Shared
// cut vertices join skin and fabric exactly, including the narrow straps.
function femaleTopology(viewer){
 const sourceCount=viewer.geometry.attributes.position.count;
 const surface=referenceSurface(viewer),reference=Array.from(surface.reference);
 const weights=Array.from({length:sourceCount},(_,i)=>surface.weights[i*3]);
 const bindings=[],midpoints=new Map(),cuts=new Map(),skin=[],clothing=[],edges=[];
 const fields=weights.map((arm,i)=>femalePattern(...reference.slice(i*3,i*3+3),arm));
 const append=(a,b,t)=>{
   const index=weights.length;bindings.push({a,b,t});
   for(let axis=0;axis<3;axis++)reference.push(reference[a*3+axis]+(reference[b*3+axis]-reference[a*3+axis])*t);
   weights.push(weights[a]+(weights[b]-weights[a])*t);
   fields.push(femalePattern(...reference.slice(index*3,index*3+3),weights[index]));
   return index;
 };
 const midpoint=(a,b)=>{
   const key=a<b?`${a}:${b}`:`${b}:${a}`;
   if(!midpoints.has(key))midpoints.set(key,append(a,b,.5));
   return midpoints.get(key);
 };
 const cut=(a,b)=>{
   const key=a<b?`${a}:${b}`:`${b}:${a}`;
   if(!cuts.has(key))cuts.set(key,append(a,b,fields[a]/(fields[a]-fields[b])));
   return cuts.get(key);
 };
 let topFaces=0,briefsFaces=0;
 const partition=face=>{
   const dressed=[],exposed=[],seam=[];
   for(let i=0;i<3;i++){
     const a=face[i],b=face[(i+1)%3],inside=fields[a]>=0;
     (inside?dressed:exposed).push(a);
     if(inside!==(fields[b]>=0)){const v=cut(a,b);dressed.push(v);exposed.push(v);seam.push(v);}
   }
   for(const[polygon,output]of[[dressed,clothing],[exposed,skin]]){
     for(let i=1;i<polygon.length-1;i++)output.push(polygon[0],polygon[i],polygon[i+1]);
   }
   if(seam.length===2)edges.push(seam);
   if(dressed.length>=3){
     if(reference[face[0]*3+1]>.65)topFaces+=dressed.length-2;
     else briefsFaces+=dressed.length-2;
   }
 };
 const indices=viewer.geometry.index.array;
 for(let i=0;i<indices.length;i+=3){
   const face=[indices[i],indices[i+1],indices[i+2]];
   // Extra samples only around the shoulder straps keep them continuous even
   // where a strap is narrower than a reference triangle.
   const y=face.reduce((s,v)=>s+reference[v*3+1],0)/3;
   const nearStrap=face.some(v=>Math.abs(Math.abs(reference[v*3])-.074)<.025);
   if(y>.73&&y<.845&&nearStrap){
     const[a,b,c]=face;midpoint(a,b);midpoint(b,c);midpoint(c,a);
   }
 }
 // Split neighboring faces along shared midpoints too. This keeps smoothing
 // from opening cracks where the finer strap mesh meets the rest of the body.
 const mid=(a,b)=>midpoints.get(a<b?`${a}:${b}`:`${b}:${a}`);
 for(let i=0;i<indices.length;i+=3){
   let[a,b,c]=[indices[i],indices[i+1],indices[i+2]];
   let ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
   const splits=[ab,bc,ca].filter(v=>v!==undefined).length;
   if(splits===3){for(const part of[[a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]])partition(part);}
   else if(splits===0)partition([a,b,c]);
   else{
     while(ab===undefined||(splits===2&&bc===undefined)){
       [a,b,c]=[b,c,a];[ab,bc,ca]=[bc,ca,ab];
     }
     if(splits===1){partition([a,ab,c]);partition([ab,b,c]);}
     else{partition([b,bc,ab]);partition([a,ab,c]);partition([ab,bc,c]);}
   }
 }
 const count=weights.length,worn=new Uint8Array(count),bare=new Uint8Array(count);
 const neighbors=Array.from({length:count},()=>new Set());
 for(const[faces,mask]of[[skin,bare],[clothing,worn]])for(let i=0;i<faces.length;i+=3){
   const face=faces.slice(i,i+3);for(const v of face)mask[v]=1;
   for(let j=0;j<3;j++){const a=face[j],b=face[(j+1)%3];neighbors[a].add(b);neighbors[b].add(a);}
 }
 const colors=new Float32Array(count*3),fabricColor=new THREE.Color(FABRIC_COLOR),bandColor=new THREE.Color(BAND_COLOR);
 for(let i=0;i<count;i++){
   const y=reference[i*3+1],band=y>.66&&y<.688;
   (band?bandColor:fabricColor).toArray(colors,i*3);
 }
 return {count,sourceCount,bindings,skin,clothing,neighbors:neighbors.map(n=>[...n]),worn,bare,edges,hems:[],colors,topFaces,briefsFaces,shortsFaces:0};
}

// Male profiles wear only base shorts; selected shirts are separate garments.
// The complete measurement surface stays independent of the visible clothing.
export function garmentTopology(viewer,gender='female'){
 if(gender==='female')return femaleTopology(viewer);
 const geometry=viewer.geometry,count=geometry.attributes.position.count;
 const reference=new Float32Array(count*3),weights=new Float32Array(count*3);
 const source=viewer.data.positions;
 const sourceWeights=new Float32Array(source.length);
 for(let i=0;i<source.length/3;i++)sourceWeights[i*3]=viewer.data.armWeights?.[i]||0;
 if(viewer.surface){viewer.surface.apply(source,reference);viewer.surface.apply(sourceWeights,weights);}
 else{reference.set(source);weights.set(sourceWeights);}
 const indices=geometry.index.array,skin=[],clothing=[],neighbors=Array.from({length:count},()=>new Set());
 const worn=new Uint8Array(count),bare=new Uint8Array(count),edges=new Map();
 let shortsFaces=0;
 for(let i=0;i<indices.length;i+=3){
   const a=indices[i],b=indices[i+1],c=indices[i+2];
   const y=(reference[a*3+1]+reference[b*3+1]+reference[c*3+1])/3;
   const arm=(weights[a*3]+weights[b*3]+weights[c*3])/3;
   const shorts=y>=.405&&y<=.585&&arm<.1;
   const selected=shorts;(selected?clothing:skin).push(a,b,c);
   if(shorts)shortsFaces++;
   for(const v of[a,b,c])(selected?worn:bare)[v]=1;
   for(const[u,v]of[[a,b],[b,c],[c,a]]){
     neighbors[u].add(v);neighbors[v].add(u);
     if(selected){const key=Math.min(u,v)*count+Math.max(u,v);if(edges.has(key))edges.delete(key);else edges.set(key,[u,v]);}
   }
 }
 const hemLevels=[.405,.585],hems=hemLevels.map(()=>[]);
 for(let i=0;i<count;i++)if(worn[i]&&bare[i]){
   let closest=0;for(let j=1;j<hemLevels.length;j++)if(Math.abs(reference[i*3+1]-hemLevels[j])<Math.abs(reference[i*3+1]-hemLevels[closest]))closest=j;
   if(Math.abs(reference[i*3+1]-hemLevels[closest])<.022)hems[closest].push(i);
 }
 return {count,skin,clothing,neighbors:neighbors.map(x=>Array.from(x)),worn,bare,edges:[...edges.values()],hems,topFaces:0,shortsFaces};
}

export function applyUndergarments(viewer,gender='female'){
 if(!viewer.mesh||!viewer.bodyGroup)return;
 const source=viewer.geometry;
 if(!viewer.garments||viewer.garments.gender!==gender||(viewer.garments.topology.sourceCount??viewer.garments.topology.count)!==source.attributes.position.count){
   disposeUndergarments(viewer);
   const topology=garmentTopology(viewer,gender),skin=new THREE.BufferGeometry(),fabric=new THREE.BufferGeometry();
   skin.setIndex(topology.skin);fabric.setIndex(topology.clothing);
   fabric.setAttribute('position',new THREE.BufferAttribute(new Float32Array(topology.count*3),3));
   if(topology.colors)fabric.setAttribute('color',new THREE.BufferAttribute(topology.colors,3));
   const material=new THREE.MeshStandardMaterial({color:gender==='female'?0xffffff:FABRIC_COLOR,vertexColors:!!topology.colors,roughness:.97,metalness:0,side:THREE.DoubleSide});
   const mesh=new THREE.Mesh(fabric,material);mesh.name=gender==='female'?'Black bralette and briefs':'Black fitted shorts';mesh.castShadow=true;mesh.receiveShadow=false;mesh.renderOrder=1;
   const trimGeometry=new THREE.BufferGeometry();trimGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(topology.edges.length*6),3));
   const trim=new THREE.LineSegments(trimGeometry,new THREE.LineBasicMaterial({color:TRIM_COLOR,transparent:false}));trim.renderOrder=2;
   viewer.bodyGroup.add(mesh,trim);viewer.garments={gender,topology,skin,fabric,mesh,material,trim};
 }
 const {topology,skin,fabric,trim}=viewer.garments;
 const original=new Float32Array(topology.count*3),normal=new Float32Array(topology.count*3);
 original.set(source.attributes.position.array);normal.set(source.attributes.normal.array);
 // Added sewing-line vertices use the same interpolation after each morph.
 for(let j=0;j<(topology.bindings?.length||0);j++){
   const {a,b,t}=topology.bindings[j],i=topology.sourceCount+j;
   for(const array of[original,normal])for(let axis=0;axis<3;axis++)array[i*3+axis]=array[a*3+axis]+(array[b*3+axis]-array[a*3+axis])*t;
 }
 const skinPositions=new Float32Array(original);
 skin.setAttribute('position',new THREE.BufferAttribute(skinPositions,3));skin.setAttribute('normal',new THREE.BufferAttribute(normal,3));
 skin.boundingSphere=source.boundingSphere;viewer.mesh.geometry=skin;
 let current=new Float32Array(original),next=new Float32Array(original);
 // Smooth local surface detail while keeping the garment hems attached to skin.
 for(let pass=0;pass<(gender==='female'?240:12);pass++){
   for(let i=0;i<topology.count;i++){
     if(!topology.worn[i]||topology.bare[i])continue;
     const neighbors=topology.neighbors[i];
     for(let axis=0;axis<3;axis++){
       let sum=0;for(const j of neighbors)sum+=current[j*3+axis];
       next[i*3+axis]=current[i*3+axis]*.3+(sum/neighbors.length)*.7;
     }
   }
   [current,next]=[next,current];
 }
 const positions=fabric.attributes.position.array;
 const offset=(viewer.bodyHeight||1.7)*.0015;
 positions.set(current);
 // Offset along the softened fabric normals. Using the body's normals here
 // would stamp small anatomical details back into the smooth cloth.
 fabric.computeVertexNormals();
 const fabricNormals=gender==='female'?fabric.attributes.normal.array:normal;
 for(let i=0;i<topology.count;i++)if(topology.worn[i]&&!topology.bare[i])for(let axis=0;axis<3;axis++)positions[i*3+axis]+=fabricNormals[i*3+axis]*offset;
 // Level both sides of each shared hem, eliminating triangle-shaped garment
 // edges without exposing gaps or altering the measurement mesh.
 for(const hem of topology.hems){
   if(!hem.length)continue;const y=hem.reduce((sum,i)=>sum+original[i*3+1],0)/hem.length;
   for(const i of hem){skinPositions[i*3+1]=y;positions[i*3+1]=y;}
 }
 fabric.attributes.position.needsUpdate=true;fabric.computeVertexNormals();fabric.computeBoundingSphere();
 const trimPositions=trim.geometry.attributes.position.array;
 topology.edges.forEach(([a,b],i)=>{for(let axis=0;axis<3;axis++){trimPositions[i*6+axis]=positions[a*3+axis]+normal[a*3+axis]*.0004;trimPositions[i*6+3+axis]=positions[b*3+axis]+normal[b*3+axis]*.0004;}});
 trim.geometry.attributes.position.needsUpdate=true;trim.geometry.computeBoundingSphere();
}

export function disposeUndergarments(viewer){
 const garments=viewer.garments;if(!garments)return;
 viewer.bodyGroup.remove(garments.mesh,garments.trim);
 garments.skin.dispose();garments.fabric.dispose();garments.material.dispose();garments.trim.geometry.dispose();garments.trim.material.dispose();viewer.garments=null;
}
