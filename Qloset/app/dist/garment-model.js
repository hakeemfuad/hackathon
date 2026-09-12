import * as THREE from './vendor/three.module.js';

const INCH=.0254,TAU=Math.PI*2;
const mix=(a,b,t)=>a+(b-a)*t;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const vec=a=>new THREE.Vector3(...a);
const fields={pants:['waist','hip','thigh','inseam'],top:['chest','hem','shoulder_width','sleeve_length','length','upper_arm']};
export const GARMENT_NOTE='Sample geometry and colors. Size charts use finished-garment inches. Fabric stretch and drape are not simulated.';

export function garmentSize(product,label){
  if(!product||!['pants','short_sleeve_shirt','long_sleeve_shirt','hoodie'].includes(product.category))throw new Error('Choose a supported garment.');
  const entry=product.sizes.find(s=>s.size===label);
  if(!entry)throw new Error('This size is not available for this garment.');
  for(const key of fields[product.category==='pants'?'pants':'top'])if(!Number.isFinite(entry.measurements[key])||entry.measurements[key]<=0)throw new Error(`Missing garment measurement: ${key}.`);
  const extra=product.category==='pants'?['rise','knee','leg_opening']:['neck_width','neck_depth','cuff',...(product.category==='hoodie'?['hood_width','hood_height']:[])];
  for(const key of extra)if(!Number.isFinite(entry.render_dimensions?.[key])||entry.render_dimensions[key]<=0)throw new Error(`Missing construction dimension: ${key}.`);
  return entry;
}

export function garmentFit(product,label,m){
  const {measurements:g}=garmentSize(product,label),pants=product.category==='pants';
  const pairs=pants?[['waist','waist_cm'],['hip','hip_cm'],['thigh','thigh_cm']]:[['chest','bust_cm'],['upper_arm','upper_arm_cm']];
  if(!pants&&g.length>m.height_cm/2.54*.333)pairs.push(['hem','hip_cm']);
  const comparisons=pairs.map(([key,body])=>({key,garment:g[key],body:m[body]/2.54,ease:g[key]-m[body]/2.54}));
  const tooSmall=comparisons.filter(c=>c.ease<.2);
  return {canWear:!tooSmall.length,comparisons,tooSmall,
    message:tooSmall.length?`Too small at the ${tooSmall.map(c=>c.key==='hem'?'hips / hem':c.key.replaceAll('_',' ')).join(' and ')}. Choose a larger size.`:`${pants?'Waist':'Chest'} room: +${comparisons[0].ease.toFixed(1)} in${comparisons[0].ease>(pants?4:9)?' · extra roomy':''}.`};
}

export function suggestedSize(product,m){
  const candidates=product.sizes.map(s=>({size:s.size,fit:garmentFit(product,s.size,m)})).filter(s=>s.fit.canWear);
  const target=product.category==='pants'?1.5:product.category==='hoodie'?7:4;
  candidates.sort((a,b)=>Math.abs(a.fit.comparisons[0].ease-target)-Math.abs(b.fit.comparisons[0].ease-target));
  return candidates[0]?.size||product.sizes.at(-1).size;
}

// Each ring has a numerically normalized perimeter. Size labels never scale
// the avatar, and geometry is always expressed in meters like the body mesh.
export function ellipseRadii(perimeter,ratio=.68,segments=64){
  let length=0;
  for(let i=0;i<segments;i++){const a=i*TAU/segments,b=(i+1)*TAU/segments;length+=Math.hypot(Math.cos(a)-Math.cos(b),ratio*(Math.sin(a)-Math.sin(b)));}
  return [perimeter/length,perimeter*ratio/length];
}
function geometry(points,indices){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();return g;
}
function loft(rings,material,group,name){
  const n=rings[0].length,points=rings.flat(2),indices=[];
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<n;i++){const a=j*n+i,b=j*n+(i+1)%n,c=a+n,d=b+n;indices.push(a,b,c,b,d,c);}
  const g=geometry(points,indices),uv=[];for(let j=0;j<rings.length;j++)for(let i=0;i<n;i++)uv.push(i/n,j/(rings.length-1));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  const mesh=new THREE.Mesh(g,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=false;group.add(mesh);return mesh;
}
function ring(y,circumference,ratio=.68,z=0){const [a,b]=ellipseRadii(circumference,ratio);return Array.from({length:64},(_,i)=>{const t=i*TAU/64;return [a*Math.cos(t),y,z+b*Math.sin(t)];});}
function seam(points,material,group,closed=false,width=.0012){
  const path=new THREE.CatmullRomCurve3(points.map(vec),closed);const mesh=new THREE.Mesh(new THREE.TubeGeometry(path,Math.max(points.length,24),width,5,closed),material);group.add(mesh);return mesh;
}
function tube(rings,material,group,name){return loft(rings,material,group,name);}

export function bodyAnchors(viewer){
  // Bone attachments interpolate nearby vertices on the *current* control cage.
  // This preserves the same gender morph, arm pose and limb proportions.
  if(!viewer.garmentAttachments){
    viewer.garmentAttachments={};
    for(const name of ['l-shoulder','l-elbow','l-hand','l-knee','l-ankle']){
      const joint=viewer.data.joints[name],nearest=[];
      for(let i=0;i<viewer.data.positions.length;i+=3)nearest.push([joint.reduce((sum,v,k)=>sum+(viewer.data.positions[i+k]-v)**2,0),i]);
      nearest.sort((a,b)=>a[0]-b[0]);viewer.garmentAttachments[name]=nearest.slice(0,24);
    }
  }
  const anchor=name=>{const points=viewer.garmentAttachments[name],total=points.reduce((s,[d])=>s+1/(d+.0001),0);return [0,1,2].map(k=>points.reduce((s,[d,i])=>s+viewer.controlPositions[i+k]/(d+.0001),0)/total);};
  const sections=[],xyz=viewer.controlPositions;
  for(let t=.40;t<=.81;t+=.025){const y=viewer.landmarkY(t);let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
    for(let i=0;i<xyz.length;i+=3)if(viewer.armWeights[i/3]<.15&&Math.abs(xyz[i+1]-y)<viewer.bodyHeight*.013){minX=Math.min(minX,xyz[i]);maxX=Math.max(maxX,xyz[i]);minZ=Math.min(minZ,xyz[i+2]);maxZ=Math.max(maxZ,xyz[i+2]);}
    if(Number.isFinite(minX)&&maxX>minX)sections.push({y,z:(minZ+maxZ)/2,ratio:clamp((maxZ-minZ)/(maxX-minX),.55,.85)});
  }
  return {height:viewer.bodyHeight,neck:viewer.landmarkY(.858),chest:viewer.landmarkY(.735),waist:viewer.landmarkY(.635),hip:viewer.landmarkY(.525),crotch:viewer.landmarkY(.475),shoulder:anchor('l-shoulder'),elbow:anchor('l-elbow'),wrist:anchor('l-hand'),knee:anchor('l-knee'),ankle:anchor('l-ankle'),sections};
}

function sectionAt(a,y){const sections=a.sections;if(!sections?.length)return {z:.045,ratio:.68};if(y<=sections[0].y)return sections[0];for(let i=1;i<sections.length;i++)if(y<sections[i].y){const t=(y-sections[i-1].y)/(sections[i].y-sections[i-1].y);return {z:mix(sections[i-1].z,sections[i].z,t),ratio:mix(sections[i-1].ratio,sections[i].ratio,t)};}return sections.at(-1);}

let clothTexture;
function fabricTexture(){
  if(clothTexture)return clothTexture;
  const n=64,data=new Uint8Array(n*n*4);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const k=(y*n+x)*4,v=214+((x+y)%2)*17+((x*13+y*7)%9);data[k]=data[k+1]=data[k+2]=v;data[k+3]=255;}
  clothTexture=new THREE.DataTexture(data,n,n);clothTexture.wrapS=clothTexture.wrapT=THREE.RepeatWrapping;clothTexture.repeat.set(8,8);clothTexture.needsUpdate=true;return clothTexture;
}
function makeMaterial(product){return new THREE.MeshStandardMaterial({color:product.render?.color||'#687989',roughness:.94,metalness:0,side:THREE.DoubleSide,bumpMap:fabricTexture(),bumpScale:.00035});}
function detailMaterial(material){return new THREE.MeshStandardMaterial({color:material.color.clone().multiplyScalar(.78),roughness:1,side:THREE.DoubleSide});}

function makeTop(product,entry,a,group,material,detail){
  const m=Object.fromEntries(Object.entries(entry.measurements).map(([k,v])=>[k,v*INCH]));
  const d=Object.fromEntries(Object.entries(entry.render_dimensions).map(([k,v])=>[k,v*INCH]));
  const hoodie=product.category==='hoodie',hem=a.neck-m.length,chestY=Math.min(a.chest,a.neck-.10),shoulderY=a.neck-.052;
  const chestRatio=sectionAt(a,chestY).ratio,bodyRings=[];
  for(let i=0;i<=16;i++){
    const t=i/16,y=mix(hem,chestY,t),c=mix(m.hem,m.chest,t);
    const section=sectionAt(a,y);bodyRings.push(ring(y,c,section.ratio,section.z));
  }
  const [chestA,chestB]=ellipseRadii(m.chest,chestRatio);
  const shoulderRing=Array.from({length:64},(_,i)=>{const t=i*TAU/64;return [m.shoulder_width/2*Math.cos(t),shoulderY-.032*Math.abs(Math.sin(t)),chestB*.78*Math.sin(t)+.035];});
  for(let k=1;k<=5;k++)bodyRings.push(bodyRings[16].map((p,i)=>p.map((v,j)=>mix(v,shoulderRing[i][j],k/5))));
  const neckRing=Array.from({length:64},(_,i)=>{const t=i*TAU/64;return [d.neck_width/2*Math.cos(t),a.neck-d.neck_depth*Math.max(0,Math.sin(t)),d.neck_width*.35*Math.sin(t)+.023];});
  for(let k=1;k<=5;k++)bodyRings.push(shoulderRing.map((p,i)=>p.map((v,j)=>mix(v,neckRing[i][j],k/5))));
  loft(bodyRings,material,group,'Torso');seam(bodyRings[0],detail,group,true);seam(neckRing,detail,group,true,hoodie?.004:.0025);
  const sleeves=[];
  for(const sign of [-1,1]){
    const start=vec([sign*(m.shoulder_width/2-.062),shoulderY-.024,a.shoulder[2]+.025]);
    const elbow=vec([sign*a.elbow[0],a.elbow[1],a.elbow[2]]),wrist=vec([sign*a.wrist[0],a.wrist[1],a.wrist[2]]);
    const curve=new THREE.CatmullRomCurve3([start,elbow,wrist]);const length=curve.getLength(),rings=[];
    const pointAt=distance=>distance<=length?curve.getPointAt(distance/length):wrist.clone().add(wrist.clone().sub(elbow).normalize().multiplyScalar(distance-length));
    for(let j=0;j<=20;j++){
      const t=j/20,dist=m.sleeve_length*t,center=pointAt(dist),direction=pointAt(dist+.002).sub(pointAt(Math.max(0,dist-.002))).normalize();
      const u=new THREE.Vector3(0,0,1).cross(direction).normalize(),v=direction.clone().cross(u).normalize();
      const circumference=mix(m.upper_arm,d.cuff,Math.pow(t,1.35)),[r1,r2]=ellipseRadii(circumference,.94,32);
      rings.push(Array.from({length:32},(_,i)=>center.clone().addScaledVector(u,Math.cos(i*TAU/32)*r1).addScaledVector(v,Math.sin(i*TAU/32)*r2).toArray()));
    }
    tube(rings,material,group,sign<0?'Right sleeve':'Left sleeve');seam(rings.at(-1),detail,group,true,hoodie?.003:.0015);
    sleeves.push({centers:Array.from({length:25},(_,j)=>pointAt(m.sleeve_length*j/24).toArray()),radius:m.upper_arm/TAU});
  }
  if(product.render.neckline==='mock')loft([neckRing,neckRing.map(([x,y,z])=>[x*.95,y+.04,z*.95])],detail,group,'Mock neck');
  if(product.render.neckline==='collar'){
    for(const sign of [-1,1]){const points=[sign*d.neck_width*.48,a.neck-.007,.02,sign*.015,a.neck-d.neck_depth,.075,sign*d.neck_width*.37,a.neck-.12,.10,sign*d.neck_width*.70,a.neck-.07,.06];const mesh=new THREE.Mesh(geometry(points,[0,1,2,0,2,3]),detail);group.add(mesh);}
  }
  const front=y=>{const t=clamp((y-hem)/(chestY-hem),0,1),section=sectionAt(a,y);return ellipseRadii(mix(m.hem,m.chest,t),section.ratio)[1]+section.z+.003;};
  if(product.render.closure!=='none'){
    const bottom=product.render.closure==='placket'?a.neck-.21:hem+.012,top=a.neck-d.neck_depth;
    seam([[0,top,front(top)],[0,chestY,front(chestY)],[0,bottom,front(bottom)]],detail,group,false,.002);
    if(product.render.closure!=='zip')for(let y=top-.025;y>bottom;y-=.075){const button=new THREE.Mesh(new THREE.SphereGeometry(.003,8,6),detail);button.position.set(0,y,front(y)+.002);group.add(button);}
  }
  if(hoodie){
    // The hood rests behind the neck as an open fabric bowl, not over the head.
    const hood=[];for(let j=0;j<=16;j++){const t=j/16,y=a.neck+.025-t*d.hood_height*.72,rx=d.hood_width/2*(.65+.35*Math.sin(t*Math.PI));hood.push(Array.from({length:40},(_,i)=>{const q=i*TAU/40;return [rx*Math.cos(q),y+.025*Math.sin(q),-.065-d.hood_width*.35*(.4+.6*Math.sin(t*Math.PI))+d.hood_width*.28*Math.sin(q)];}));}
    loft(hood,material,group,'Resting hood');seam(hood[0],detail,group,true,.003);
    const pocketY=mix(hem,chestY,.32),pocketZ=front(pocketY)+.003;
    seam([[-chestA*.6,pocketY+.06,pocketZ],[-chestA*.72,pocketY-.06,pocketZ],[chestA*.72,pocketY-.06,pocketZ],[chestA*.6,pocketY+.06,pocketZ]],detail,group,false,.0018);
    for(const sign of [-1,1])seam([[sign*.04,a.neck-.055,.075],[sign*.055,a.neck-.13,front(chestY)],[sign*.047,a.neck-.23,front(chestY)+.004]],detail,group,false,.0018);
  }
  group.userData.dimensions={units:'m',chest:m.chest,hem:m.hem,length:m.length,shoulder_width:m.shoulder_width,sleeve_length:m.sleeve_length};
  return (p,arm)=>{
    if(arm<.5&&p[1]>hem+.025&&p[1]<a.neck-.07)return true;
    if(arm>.15)for(const sleeve of sleeves)for(const c of sleeve.centers.slice(0,-2))if((p[0]-c[0])**2+(p[1]-c[1])**2+(p[2]-c[2])**2<(sleeve.radius*.94)**2)return true;
    return false;
  };
}

function makePants(product,entry,a,group,material,detail){
  const m=Object.fromEntries(Object.entries(entry.measurements).map(([k,v])=>[k,v*INCH]));
  const d=Object.fromEntries(Object.entries(entry.render_dimensions).map(([k,v])=>[k,v*INCH]));
  const waist=a.waist,crotch=waist-d.rise,hem=crotch-m.inseam;
  const hipY=mix(waist,crotch,.52),waistSection=sectionAt(a,waist),hipSection=sectionAt(a,hipY),crotchSection=sectionAt(a,crotch),[wa,wb]=ellipseRadii(m.waist,waistSection.ratio),[ha,hb]=ellipseRadii(m.hip,hipSection.ratio);
  const thighR=ellipseRadii(m.thigh,.91,48),legCenter=Math.max(ha*.49,thighR[0]*.88);
  for(const sign of [-1,1]){
    const rings=[];
    // Two D-shaped pelvis halves share an internal seam and divide naturally
    // into separate leg openings at the crotch.
    for(let j=0;j<=12;j++){
      const t=j/12,y=mix(waist,crotch,t),lower=clamp((t-.52)/.48,0,1);
      const ra=mix(wa,ha,Math.min(t/.52,1)),rb=mix(wb,hb,Math.min(t/.52,1));
      rings.push(Array.from({length:48},(_,i)=>{
        const theta=i*TAU/48,outer=i<=24;
        const x=outer?ra*Math.sin(theta):0,z=rb*Math.cos(theta);
        return [sign*mix(x,legCenter+thighR[0]*Math.sin(theta),lower),y,mix(z,thighR[1]*Math.cos(theta),lower)+sectionAt(a,y).z];
      }));
    }
    for(let j=1;j<=28;j++){
      const t=j/28,y=mix(crotch,hem,t),center=mix(legCenter,a.ankle[0],t),k=t<.52?mix(m.thigh,d.knee,t/.52):mix(d.knee,d.leg_opening,(t-.52)/.48),[rx,rz]=ellipseRadii(k,.91,48);
      rings.push(Array.from({length:48},(_,i)=>{const q=i*TAU/48;return [sign*(center+rx*Math.sin(q)),y,rz*Math.cos(q)+mix(crotchSection.z,a.ankle[2],t)];}));
    }
    loft(rings,material,group,sign<0?'Right trouser leg':'Left trouser leg');seam(rings.at(-1),detail,group,true,.002);
    seam(rings.filter((_,i)=>i%3===0).map(r=>r[12]),detail,group,false,.0009);
    seam([[sign*wa*.55,waist-.04,wb*.86+waistSection.z],[sign*ha*.78,hipY+.025,hb*.69+hipSection.z]],detail,group,false,.0015);
  }
  const waistband=ring(waist,m.waist,waistSection.ratio,waistSection.z);loft([waistband,ring(waist-.028,mix(m.waist,m.hip,.10),waistSection.ratio,sectionAt(a,waist-.028).z)],detail,group,'Waistband');
  seam(waistband,detail,group,true,.002);seam([[0,waist-.02,wb+waistSection.z+.003],[0,hipY,hb+hipSection.z+.003]],detail,group,false,.0012);
  group.userData.dimensions={units:'m',waist:m.waist,hip:m.hip,thigh:m.thigh,inseam:m.inseam,rise:d.rise,leg_opening:d.leg_opening};
  return (p,arm)=>arm<.1&&p[1]<waist-.004&&p[1]>Math.max(hem+.006,.055*a.height);
}

export function createGarment(product,label,anchors){
  const entry=garmentSize(product,label),group=new THREE.Group(),material=makeMaterial(product),detail=detailMaterial(material);
  group.name=`${product.name} · ${label}`;group.userData={productId:product.id,size:label,category:product.category,source:'synthetic_finished_garment',measurements:{...entry.measurements},renderDimensions:{...entry.render_dimensions}};
  const covers=(product.category==='pants'?makePants:makeTop)(product,entry,anchors,group,material,detail);
  return {group,covers,product,size:label};
}

export function disposeGarment(garment){
  const materials=new Set();garment?.group.traverse(child=>{child.geometry?.dispose();if(child.material)materials.add(child.material);});for(const m of materials)m.dispose();
}

export function updateOutfit(viewer){
  if(!viewer.outfit||!viewer.garments)return;
  const anchors=bodyAnchors(viewer),active=[];
  for(const item of Object.values(viewer.outfit)){
    if(item.model){viewer.bodyGroup.remove(item.model.group);disposeGarment(item.model);item.model=null;}
    item.fit=garmentFit(item.product,item.size,viewer.measurements);
    if(item.fit.canWear){item.model=createGarment(item.product,item.size,anchors);viewer.bodyGroup.add(item.model.group);active.push(item.model);}
  }
  // The outer shirt occludes the pants beneath it, including their waistband
  // and pocket seams. Keep the standalone garment definition complete.
  const top=viewer.outfit.top?.model,bottom=viewer.outfit.bottom?.model;
  if(top&&bottom)bottom.group.traverse(mesh=>{
    if(!mesh.geometry?.index)return;const xyz=mesh.geometry.attributes.position.array,indices=mesh.geometry.index.array,visible=[];
    for(let i=0;i<indices.length;i+=3){const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3,p=[0,1,2].map(k=>(xyz[a+k]+xyz[b+k]+xyz[c+k])/3);if(!top.covers(p,0))visible.push(indices[i],indices[i+1],indices[i+2]);}
    mesh.geometry.setIndex(visible);
  });
  const {topology,skin,fabric,trim}=viewer.garments;
  if(!active.length){skin.setIndex(topology.skin);fabric.setIndex(topology.clothing);trim.visible=true;return;}
  if(viewer.outfitWeightTopology!==topology){
    const src=new Float32Array(viewer.data.positions.length),dst=new Float32Array(topology.count*3);for(let i=0;i<viewer.armWeights.length;i++)src[i*3]=viewer.armWeights[i];viewer.surface.apply(src,dst);
    for(let j=0;j<(topology.bindings?.length||0);j++){const {a,b,t}=topology.bindings[j];dst[(topology.sourceCount+j)*3]=mix(dst[a*3],dst[b*3],t);}
    viewer.outfitArmWeights=dst;viewer.outfitWeightTopology=topology;
  }
  const xyz=skin.attributes.position.array,weights=viewer.outfitArmWeights;
  const visible=indices=>{const out=[];for(let i=0;i<indices.length;i+=3){const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3,p=[0,1,2].map(k=>(xyz[a+k]+xyz[b+k]+xyz[c+k])/3),arm=(weights[a]+weights[b]+weights[c])/3;if(!active.some(g=>g.covers(p,arm)))out.push(indices[i],indices[i+1],indices[i+2]);}return out;};
  skin.setIndex(visible(topology.skin));fabric.setIndex(visible(topology.clothing));trim.visible=false;
}
