import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {BodyViewer,slice,createSurface,armWeights} from '../dist/body-viewer.js';
import {DEFAULT_PROFILE,PRESETS,estimateMeasurements,validateProfile} from '../dist/measurements.js';
const data=JSON.parse(await readFile(new URL('../dist/body.json',import.meta.url),'utf8'));
const base=new Float32Array(data.positions),baseSlices={};
for(const[k,y]of [['bust',.735],['waist',.635],['hip',.525]])baseSlices[k]=slice(base,data.indices,y,k==='bust'?.125:.14).length;
const surface=createSurface(data.indices,base.length/3);
const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(surface.count*3),3));geometry.setIndex(surface.indices);
const mock={ready:true,base,baseSlices,data,geometry,surface,controlPositions:new Float32Array(base.length),armWeights:armWeights(data),camera:{lookAt(){}},rebuildContours(){},resize(){}};
const reports=[],meshes=[];
for(const preset of PRESETS){
 const {name,...p}=preset,profile={...DEFAULT_PROFILE,...p},m=estimateMeasurements(profile);
 BodyViewer.prototype.update.call(mock,profile,m);const xyz=Array.from(geometry.attributes.position.array);
 assert(xyz.every(Number.isFinite));const ys=xyz.filter((_,i)=>i%3===1),height=(Math.max(...ys)-Math.min(...ys))*100;
 assert(Math.abs(height-profile.height_cm)<.02,'Height must match the input exactly.');
 const measured={};for(const[k,y]of [['bust',.735],['waist',.635],['hip',.525]]){measured[k]=+(slice(xyz,surface.indices,mock.landmarkY(y)).length*100).toFixed(1);assert(Math.abs(measured[k]-m[k+'_cm'])<1,`${name} ${k}: actual ${measured[k]}, expected ${m[k+"_cm"]}`);}
 reports.push({name,height,targets:{bust:m.bust_cm,waist:m.waist_cm,hip:m.hip_cm},mesh:measured});
 meshes.push({name,positions:xyz,indices:surface.indices,normals:Array.from(geometry.attributes.normal.array)});
}
// The silhouette must remain connected and measurable as limb lengths change.
for(const legs of ['short','long'])for(const arms of ['short','long']){
 const p={...DEFAULT_PROFILE,legs,arms},m=estimateMeasurements(p);BodyViewer.prototype.update.call(mock,p,m);
 for(const[k,y]of [['bust',.735],['waist',.635],['hip',.525]])assert(Math.abs(slice(geometry.attributes.position.array,surface.indices,mock.landmarkY(y)).length*100-m[k+'_cm'])<1,`${legs} legs / ${arms} arms: ${k} remains measurable`);
 assert(Array.from(geometry.attributes.normal.array).every(Number.isFinite),'Surface normals must be finite.');
}
for(const bad of [{height_cm:0},{height_cm:NaN},{weight_kg:Infinity},{weight_kg:201},{gender:'unknown'},{body_shape:'foo'},{arms:'shorter'}])assert.throws(()=>validateProfile({...DEFAULT_PROFILE,...bad}));
const a=estimateMeasurements(DEFAULT_PROFILE),b=estimateMeasurements({...DEFAULT_PROFILE,weight_kg:82});assert(b.waist_cm>a.waist_cm&&b.hip_cm>a.hip_cm&&b.bust_cm>a.bust_cm,'Weight changes body dimensions.');
assert.deepEqual(a,estimateMeasurements({...DEFAULT_PROFILE,ancestry:'african'}),'Unsupported ancestry must be neutral.');
await mkdir(new URL('../.sites-runtime/',import.meta.url),{recursive:true});
await writeFile(new URL('../.sites-runtime/model-check.json',import.meta.url),JSON.stringify({baseSlices,reports,meshes}));
console.log(JSON.stringify({baseSlices,reports,validation:'Inputs and height checks passed'},null,2));
