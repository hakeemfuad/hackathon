import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../dist/vendor/three.module.js';
import {BodyViewer,createSurface,armWeights,slice} from '../dist/body-viewer.js';
import {DEFAULT_PROFILE,PRESETS,estimateMeasurements} from '../dist/measurements.js';
import {bodyAnchors,createGarment,disposeGarment,garmentFit,garmentSize,suggestedSize,ellipseRadii} from '../dist/garment-model.js';

const catalog=JSON.parse(await readFile(new URL('../dist/data/products.json',import.meta.url)));
const data=JSON.parse(await readFile(new URL('../dist/body.json',import.meta.url)));
const base=new Float32Array(data.positions),surface=createSurface(data.indices,base.length/3),geometry=new THREE.BufferGeometry();
geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(surface.count*3),3));geometry.setIndex(surface.indices);
const viewer={ready:true,data,base,surface,geometry,mesh:new THREE.Mesh(geometry),bodyGroup:new THREE.Group(),controlPositions:new Float32Array(base.length),armWeights:armWeights(data),camera:{lookAt(){}},rebuildContours(){},resize(){}};
const update=p=>BodyViewer.prototype.update.call(viewer,p,estimateMeasurements(p));
const wear=(p,s)=>BodyViewer.prototype.wear.call(viewer,p,s);
const remove=slot=>BodyViewer.prototype.removeGarment.call(viewer,slot);
const finite=model=>model.group.traverse(mesh=>{if(!mesh.geometry)return;for(const [name,attribute]of Object.entries(mesh.geometry.attributes))assert(Array.from(attribute.array).every(Number.isFinite),`${model.group.name}: finite ${name}`);assert(Array.from(mesh.geometry.index.array).every(i=>i<mesh.geometry.attributes.position.count),'No out-of-range garment indices.');});
update(DEFAULT_PROFILE);
const anchors=bodyAnchors(viewer),original=Array.from(geometry.attributes.position.array),originalIndices=Array.from(geometry.index.array);
let variants=0;
for(const product of catalog.products)for(const entry of product.sizes){
  const model=createGarment(product,entry.size,anchors);finite(model);assert.equal(model.group.userData.productId,product.id);assert.deepEqual(model.group.userData.measurements,entry.measurements);disposeGarment(model);variants++;
}
assert.equal(variants,280);
const tee=catalog.products.find(p=>p.id==='short_sleeve_shirt-01'),pants=catalog.products.find(p=>p.id==='pants-01');
assert.throws(()=>garmentSize(tee,'INVALID'));
assert.throws(()=>createGarment({...tee,sizes:[{size:'X',measurements:{chest:NaN}}]},'X',anchors));
assert.equal(garmentFit(tee,'XS',estimateMeasurements(DEFAULT_PROFILE)).canWear,false);
assert.throws(()=>wear(tee,'XS'));
wear(tee,suggestedSize(tee,viewer.measurements));wear(pants,suggestedSize(pants,viewer.measurements));
assert.equal(Object.keys(viewer.outfit).length,2,'A top and pants must coexist.');
assert.deepEqual(Array.from(geometry.attributes.position.array),original,'Dressing does not modify body dimensions.');
assert.deepEqual(Array.from(geometry.index.array),originalIndices,'The complete measurement topology is retained.');
const small=createGarment(tee,'S',anchors),large=createGarment(tee,'3XL',anchors);
const bbox=g=>new THREE.Box3().setFromObject(g.group).getSize(new THREE.Vector3());
assert(bbox(large).x>bbox(small).x&&bbox(large).y>bbox(small).y,'Larger sizes change width and garment length.');
for(const model of [small,large]){const torso=model.group.getObjectByName('Torso'),positions=torso.geometry.attributes.position.array;let perimeter=0;for(let i=0;i<64;i++){const j=(i+1)%64;perimeter+=Math.hypot(positions[i*3]-positions[j*3],positions[i*3+2]-positions[j*3+2]);}assert(Math.abs(perimeter-model.group.userData.measurements.hem*.0254)<.00001,'Rendered hem circumference matches the size chart.');disposeGarment(model);}
for(const preset of PRESETS){
  const {name,...profile}=preset;update({...DEFAULT_PROFILE,...profile});
  for(const category of ['pants','short_sleeve_shirt','long_sleeve_shirt','hoodie']){
    const p=catalog.products.find(p=>p.category===category),size=suggestedSize(p,viewer.measurements);
    if(garmentFit(p,size,viewer.measurements).canWear){wear(p,size);finite(viewer.outfit[category==='pants'?'bottom':'top'].model);}
  }
  for(const[k,y]of [['bust',.735],['waist',.635],['hip',.525]])assert(Math.abs(slice(geometry.attributes.position.array,surface.indices,viewer.landmarkY(y)).length*100-viewer.measurements[k+'_cm'])<1,`${name}: outfit preserves ${k}.`);
  for(const g of [viewer.garments.skin,viewer.garments.fabric]){assert(Array.from(g.attributes.position.array).every(Number.isFinite));assert(Array.from(g.index.array).every(i=>i<g.attributes.position.count),'Underwear cut vertices remain valid with clothing masks.');}
}
for(const slot of Object.keys(viewer.outfit))remove(slot);
assert.deepEqual(Array.from(viewer.garments.skin.index.array),viewer.garments.topology.skin,'Removing clothes restores all exposed skin.');
assert.deepEqual(Array.from(viewer.garments.fabric.index.array),viewer.garments.topology.clothing,'Removing clothes restores underwear.');
assert.equal(viewer.garments.trim.visible,true);
console.log(`Garment checks passed: ${variants} variants, six body profiles, size-driven geometry, measured circumferences, outfit layering/removal, too-small sizes, and unchanged body measurements.`);
