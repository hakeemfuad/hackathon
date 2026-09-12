import * as THREE from './vendor/three.module.js';
import {applyUndergarments,disposeUndergarments} from './undergarments.js';
import {updateOutfit,disposeGarment,garmentFit,garmentSize} from './garment-model.js';

export const SKIN_TONES=[
 {id:'very-light',label:'Very light',color:'#f4dfd0'},
 {id:'light',label:'Light',color:'#e8c4a6'},
 {id:'light-medium',label:'Light medium',color:'#d4ab8b'},
 {id:'medium',label:'Medium',color:'#b99b89'},
 {id:'tan',label:'Tan',color:'#b9825b'},
 {id:'brown',label:'Brown',color:'#966244'},
 {id:'deep',label:'Deep',color:'#70432e'},
 {id:'very-deep',label:'Very deep',color:'#45291e'}
];
export const DEFAULT_SKIN_TONE='medium';

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const smooth=(a,b,v)=>{let t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
const lerp=(a,b,t)=>a+(b-a)*t;
function interpolate(stations,y){
 if(y<=stations[0][0])return stations[0][1];
 for(let i=1;i<stations.length;i++)if(y<stations[i][0])return lerp(stations[i-1][1],stations[i][1],smooth(stations[i-1][0],stations[i][0],y));
 return stations.at(-1)[1];
}

// The control cage retains the reference anatomy. A single Loop subdivision
// rounds its silhouette without smoothing away facial or finger detail.
export function createSurface(indices,count){
 const neighbors=Array.from({length:count},()=>new Set()),edges=new Map(),faces=[];
 const edge=(a,b,opposite)=>{
   const key=Math.min(a,b)*count+Math.max(a,b);
   let e=edges.get(key);
   if(!e){e={a,b,opposites:[],index:count+edges.size};edges.set(key,e);}
   e.opposites.push(opposite);neighbors[a].add(b);neighbors[b].add(a);return e.index;
 };
 for(let i=0;i<indices.length;i+=3){const[a,b,c]=indices.slice(i,i+3),ab=edge(a,b,c),bc=edge(b,c,a),ca=edge(c,a,b);faces.push(a,ab,ca,b,bc,ab,c,ca,bc,ab,bc,ca);}
 const rows=neighbors.map((set,i)=>{const ns=[...set],n=ns.length,beta=n===3?3/16:3/(8*n);return [[i,1-n*beta],...ns.map(j=>[j,beta])];});
 for(const e of edges.values())rows.push(e.opposites.length===2?[[e.a,3/8],[e.b,3/8],...e.opposites.map(i=>[i,1/8])]:[[e.a,.5],[e.b,.5]]);
 return {indices:faces,count:rows.length,apply(source,target){for(let i=0;i<rows.length;i++)for(let axis=0;axis<3;axis++){let value=0;for(const[j,w]of rows[i])value+=source[j*3+axis]*w;target[i*3+axis]=value;}}};
}

// Classify on the unchanged reference, along the armpit, not across the biceps.
// Every point below the shoulder follows the same arm transform.
export function armWeights(data){
 if(data.armWeights?.length===data.positions.length/3)return new Float32Array(data.armWeights);
 const count=data.positions.length/3,adj=Array.from({length:count},()=>[]),s=new Float32Array(count),weights=new Float32Array(count),allowed=new Uint8Array(count);
 const shoulder=data.joints['l-shoulder'],elbow=data.joints['l-elbow'],axis=elbow.map((v,i)=>v-shoulder[i]),length=Math.hypot(...axis);
 let left=0,right=0;
 for(let i=0;i<count;i++){const x=data.positions[i*3],y=data.positions[i*3+1],z=data.positions[i*3+2];s[i]=((Math.abs(x)-shoulder[0])*axis[0]+(y-shoulder[1])*axis[1]+(z-shoulder[2])*axis[2])/length;allowed[i]=Math.abs(x)>.09&&s[i]>.025;if(x>data.positions[left*3])left=i;if(x<data.positions[right*3])right=i;}
 for(let i=0;i<data.indices.length;i+=3)for(let j=0;j<3;j++){const a=data.indices[i+j],b=data.indices[i+(j+1)%3];adj[a].push(b);adj[b].push(a);}
 const seen=new Set(),todo=[left,right];while(todo.length){const i=todo.pop();if(seen.has(i)||!allowed[i])continue;seen.add(i);weights[i]=smooth(.025,.075,s[i]);for(const j of adj[i])if(!seen.has(j))todo.push(j);}
 return weights;
}
function morphJoint(data,base,name){
 const joint=data.joints[name],nearest=[];
 for(let i=0;i<data.positions.length;i+=3){const distance=joint.reduce((sum,v,k)=>sum+(data.positions[i+k]-v)**2,0);nearest.push([distance,i]);}
 nearest.sort((a,b)=>a[0]-b[0]);const points=nearest.slice(0,16),total=points.reduce((sum,[d])=>sum+1/(d+.0001),0);
 return joint.map((v,k)=>v+points.reduce((sum,[d,i])=>sum+(base[i+k]-data.positions[i+k])/(d+.0001),0)/total);
}
function nearestOnBone(point,a,b){
 const delta=b.map((v,i)=>v-a[i]),t=clamp(point.reduce((sum,v,i)=>sum+(v-a[i])*delta[i],0)/delta.reduce((sum,v)=>sum+v*v,0),0,1);
 const center=a.map((v,i)=>v+t*delta[i]);return {center,distance:point.reduce((sum,v,i)=>sum+(v-center[i])**2,0)};
}

// Measure the torso's actual mesh intersection, excluding detached arm sections.
export function slice(positions,indices,y,limit=Infinity){
 const segments=[];
 for(let i=0;i<indices.length;i+=3){
   const points=[];
   for(let j=0;j<3;j++){
     const a=indices[i+j]*3,b=indices[i+(j+1)%3]*3;
     const ay=positions[a+1],by=positions[b+1];
     if((ay<y&&by>=y)||(by<y&&ay>=y)){
       const t=(y-ay)/(by-ay);points.push([lerp(positions[a],positions[b],t),y,lerp(positions[a+2],positions[b+2],t)]);
     }
   }
   if(points.length===2&&points.every(p=>Math.abs(p[0])<limit))segments.push(points);
 }
 // A horizontal plane also intersects the arms. Select the connected torso
 // loop containing the body's center, rather than summing separate limbs.
 const key=p=>p.map(n=>n.toFixed(5)).join(',');
 const adjacency=new Map();segments.forEach((s,i)=>s.forEach(p=>{const k=key(p);if(!adjacency.has(k))adjacency.set(k,[]);adjacency.get(k).push(i);}));
 const seen=new Set(),components=[];
 for(let i=0;i<segments.length;i++){
   if(seen.has(i))continue;const todo=[i],part=[];
   while(todo.length){const j=todo.pop();if(seen.has(j))continue;seen.add(j);part.push(segments[j]);for(const p of segments[j])for(const n of adjacency.get(key(p))||[])if(!seen.has(n))todo.push(n);}
   const xs=part.flatMap(s=>s.map(p=>p[0])),length=part.reduce((s,[a,b])=>s+Math.hypot(a[0]-b[0],a[2]-b[2]),0);
   components.push({segments:part,length,centered:Math.min(...xs)<=0&&Math.max(...xs)>=0});
 }
 const selected=components.filter(c=>c.centered).sort((a,b)=>b.length-a.length)[0]||components.sort((a,b)=>b.length-a.length)[0];
 return selected||{segments:[],length:0};
}

export class BodyViewer{
 constructor(container){
   this.container=container;this.targetAngle=.18;this.angle=.18;this.pitch=0;this.zoom=1;this.rotating=false;this.contoursVisible=true;this.ready=false;
   this.skinTone=DEFAULT_SKIN_TONE;
   this.scene=new THREE.Scene();
   this.camera=new THREE.PerspectiveCamera(29,1,.01,100);this.camera.position.set(0,1,4.7);this.camera.lookAt(0,.88,0);
   this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:false});
   this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setClearColor(0xeeeeec,0);this.renderer.outputColorSpace=THREE.SRGBColorSpace;
   this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
   this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.VSMShadowMap;
   this.renderer.domElement.setAttribute('aria-label','Interactive 3D body. Drag to rotate, scroll to zoom.');this.renderer.domElement.setAttribute('role','img');this.renderer.domElement.tabIndex=0;
   container.appendChild(this.renderer.domElement);
   this.scene.add(new THREE.HemisphereLight(0xf2f5ff,0x6f625c,.85));
   const key=new THREE.DirectionalLight(0xffede0,2.6);key.position.set(-2.4,3.8,3.5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-1.2;key.shadow.camera.right=1.2;key.shadow.camera.top=2.5;key.shadow.camera.bottom=-.3;key.shadow.camera.near=.1;key.shadow.camera.far=10;key.shadow.normalBias=.012;key.shadow.bias=-.00015;this.scene.add(key);
   key.shadow.radius=5;key.shadow.blurSamples=12;
   const fill=new THREE.DirectionalLight(0xe1eaff,.8);fill.position.set(2,1.8,2.5);this.scene.add(fill);
   const rim=new THREE.DirectionalLight(0xf2f0ff,1.7);rim.position.set(1.5,3,-2.5);this.scene.add(rim);
   this.bodyGroup=new THREE.Group();this.scene.add(this.bodyGroup);
   this.contours=new THREE.Group();this.bodyGroup.add(this.contours);
   const floor=new THREE.Mesh(new THREE.CircleGeometry(1.6,100),new THREE.ShadowMaterial({opacity:.09}));floor.rotation.x=-Math.PI/2;floor.position.y=-.006;floor.receiveShadow=true;this.scene.add(floor);
   const grid=new THREE.GridHelper(4,24,0xbbbdbf,0xd9dadb);grid.position.y=-.009;grid.material.transparent=true;grid.material.opacity=.13;this.scene.add(grid);
   let pointer=null;
   const canvas=this.renderer.domElement;
   canvas.addEventListener('pointerdown',e=>{pointer={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';});
   canvas.addEventListener('pointermove',e=>{if(!pointer)return;this.targetAngle+=(e.clientX-pointer.x)*.009;this.pitch=clamp(this.pitch+(e.clientY-pointer.y)*.003,-.25,.25);pointer={x:e.clientX,y:e.clientY};this.setRotating(false);this.onInteraction?.();});
   const release=()=>{pointer=null;canvas.style.cursor='grab';};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
   canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoom=clamp(this.zoom+e.deltaY*.0006,.72,1.45);},{passive:false});
   canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))e.preventDefault();if(e.key==='ArrowLeft')this.targetAngle-=.15;if(e.key==='ArrowRight')this.targetAngle+=.15;if(e.key==='ArrowUp')this.zoom=clamp(this.zoom-.08,.72,1.45);if(e.key==='ArrowDown')this.zoom=clamp(this.zoom+.08,.72,1.45);if(e.key==='Home')this.reset();});
   this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);
   this.clock=new THREE.Clock();this.animate();
 }
 async load(){
   const response=await fetch('./body.json');if(!response.ok)throw new Error('The body model could not load. Please retry.');this.data=await response.json();
   this.base=new Float32Array(this.data.positions);
   this.surface=createSurface(this.data.indices,this.base.length/3);this.controlPositions=new Float32Array(this.base.length);this.armWeights=armWeights(this.data);
   this.geometry=new THREE.BufferGeometry();this.geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(this.surface.count*3),3));this.geometry.setIndex(this.surface.indices);
   this.material=new THREE.MeshPhysicalMaterial({color:SKIN_TONES.find(tone=>tone.id===this.skinTone).color,roughness:.72,metalness:0,specularIntensity:.28,clearcoat:0});
   this.mesh=new THREE.Mesh(this.geometry,this.material);this.mesh.castShadow=true;this.mesh.receiveShadow=false;this.bodyGroup.add(this.mesh);
   this.baseSlices={};for(const [k,y]of [['bust',.735],['waist',.635],['hip',.525]])this.baseSlices[k]=slice(this.base,this.data.indices,y,k==='bust'?.125:.14).length;
   this.ready=true;
 }
 setSkinTone(id){
   const tone=SKIN_TONES.find(option=>option.id===id);
   if(!tone)throw new Error('Choose a valid skin tone.');
   this.skinTone=tone.id;
   this.material?.color.set(tone.color);
   this.renderer.domElement.setAttribute('aria-label',`Interactive 3D body with ${tone.label.toLowerCase()} skin tone. Drag to rotate, scroll to zoom.`);
 }
 update(profile,m){
   if(!this.ready)return;
   const h=m.height_cm/100,base=new Float32Array(this.data.variants?.[profile.gender]||this.base),target=this.controlPositions;
   const baseSlices={};for(const[k,y]of [['bust',.735],['waist',.635],['hip',.525]])baseSlices[k]=slice(base,this.data.indices,y).length;
   const chestScale=(m.bust_cm/m.height_cm)/baseSlices.bust,waistScale=(m.waist_cm/m.height_cm)/baseSlices.waist,hipScale=(m.hip_cm/m.height_cm)/baseSlices.hip;
   const male=profile.gender==='male',shoulderScale=(m.shoulder_width_cm/m.height_cm)/(male?.248:.231);
   const legRatio=(m.inseam_cm/m.height_cm)/.47,armRatio=(m.sleeve_length_cm/m.height_cm)/(male?.34:.33);
   const thighScale=clamp((m.thigh_cm/m.height_cm)/(male?.345:.329),.72,1.85),armScale=clamp((m.upper_arm_cm/m.height_cm)/(male?.17615:.15992),.72,1.9);
   const torsoStations=[[0,hipScale],[.525,hipScale],[.585,lerp(hipScale,waistScale,.55)],[.635,waistScale],[.685,lerp(waistScale,chestScale,.65)],[.735,chestScale],[.80,shoulderScale],[.845,1],[1,1]];
   const crotch=.48,legShift=crotch*(legRatio-1);
   const remapY=y=>y<crotch?y*legRatio:y+legShift*(1-smooth(crotch,.87,y));
   const shoulder=morphJoint(this.data,base,'l-shoulder'),elbow=morphJoint(this.data,base,'l-elbow'),wrist=morphJoint(this.data,base,'l-hand');
   for(let i=0;i<base.length;i+=3){
     const bx=base[i],by=base[i+1],bz=base[i+2],sign=bx<0?-1:1,ax=Math.abs(bx),arm=this.armWeights[i/3];
     const scale=interpolate(torsoStations,by);
     let x=bx*scale,y=by,z=bz*scale;
     // Waist depth changes gradually across the abdomen.
     z+=(m.belly_depth_cm/m.height_cm)*Math.exp(-(((by-.605)/.065)**2))*smooth(-.012,.07,bz)*(1-arm);
     // Blend a local leg transform into the pelvis, with no hard thigh seam.
     const pelvis=smooth(.40,.53,by),legAxis=interpolate([[0,.131833],[.043,.131833],[.268,.094913],[.519,.06625]],by);
     const legZ=interpolate([[0,-.000546],[.043,-.000546],[.268,.019224],[.519,.00738]],by);
     const fat=interpolate([[0,1],[.065,1],[.17,1+(thighScale-1)*.52],[.28,1+(thighScale-1)*.22],[.40,thighScale],[.53,hipScale]],by);
     const legX=sign*(legAxis+(ax-legAxis)*fat-.048*(1-smooth(.02,.52,by))+.045*(hipScale-1)*smooth(.2,.52,by));
     x=lerp(legX,x,pelvis);z=lerp(legZ+(bz-legZ)*fat,z,pelvis);
     if(arm>0){
       const point=[ax,by,bz],upper=nearestOnBone(point,shoulder,elbow),lower=nearestOnBone(point,elbow,wrist);
       const elbowBlend=1-smooth(elbow[1]-.035,elbow[1]+.035,by),center=upper.center.map((value,k)=>lerp(value,lower.center[k],elbowBlend));
       const forearm=clamp((elbow[1]-by)/(elbow[1]-wrist[1]),0,1),radial=lerp(armScale,1,smooth(0,1,forearm));
       // Preserve the bent forearm and fingers. Scale across the bone, then
       // rotate the whole limb gently around its shoulder, preserving volume.
       let px=(center[0]-shoulder[0])*armRatio+(ax-center[0])*radial;
       let py=(center[1]-shoulder[1])*armRatio+(by-center[1])*radial;
       let pz=(center[2]-shoulder[2])*armRatio+(bz-center[2])*radial;
       const angle=-.18,rx=px*Math.cos(angle)-py*Math.sin(angle),ry=px*Math.sin(angle)+py*Math.cos(angle);
       x=lerp(x,sign*(shoulder[0]*shoulderScale+rx),arm);y=lerp(y,shoulder[1]+ry,arm);z=lerp(z,shoulder[2]+pz,arm);
     }
     target[i]=x*h;target[i+1]=remapY(y)*h;target[i+2]=z*h;
   }
   // Fit the control cage using the same connected torso loop shown in the UI.
   for(let pass=0;pass<3;pass++){
     const ratios={};
     for(const[key,yy]of [['bust',.735],['waist',.635],['hip',.525]]){
       const perimeter=slice(target,this.data.indices,remapY(yy)*h).length;
       ratios[key]=perimeter>0?(m[key+'_cm']/100)/perimeter:1;
     }
     const stations=[[0,1],[.40,1],[.525,ratios.hip],[.635,ratios.waist],[.735,ratios.bust],[.805,1],[1,1]];
     for(let i=0;i<target.length;i+=3){const factor=lerp(interpolate(stations,base[i+1]),1,this.armWeights[i/3]);target[i]*=factor;target[i+2]*=factor;}
   }
   const rendered=this.geometry.attributes.position.array;
   const renderSurface=()=>{
     this.surface.apply(target,rendered);
     // Subdivision contracts extrema. Ground the feet and preserve input height.
     let minY=Infinity,maxY=-Infinity;for(let i=1;i<rendered.length;i+=3){minY=Math.min(minY,rendered[i]);maxY=Math.max(maxY,rendered[i]);}
     for(let i=1;i<rendered.length;i+=3)rendered[i]=(rendered[i]-minY)*h/(maxY-minY);
     this.landmarkY=y=>(remapY(y)*h-minY)*h/(maxY-minY);
   };
   // Refit the smoothed surface, so smoothing never silently changes the girths.
   for(let pass=0;pass<2;pass++){
     renderSurface();const ratios={};
     for(const[key,y]of [['bust',.735],['waist',.635],['hip',.525]]){const perimeter=slice(rendered,this.surface.indices,this.landmarkY(y)).length;ratios[key]=perimeter>0?(m[key+'_cm']/100)/perimeter:1;}
     const stations=[[0,1],[.40,1],[.525,ratios.hip],[.635,ratios.waist],[.735,ratios.bust],[.805,1],[1,1]];
     for(let i=0;i<target.length;i+=3){const factor=lerp(interpolate(stations,base[i+1]),1,this.armWeights[i/3]);target[i]*=factor;target[i+2]*=factor;}
   }
   renderSurface();
   this.geometry.attributes.position.needsUpdate=true;this.geometry.computeVertexNormals();this.geometry.computeBoundingSphere();
   this.bodyHeight=h;this.measurements={...m};this.garmentBody=null;applyUndergarments(this,profile.gender);updateOutfit(this);this.camera.lookAt(0,h*.5,0);this.rebuildContours(m,remapY);this.resize();
 }
 rebuildContours(m,remapY){
   for(const child of [...this.contours.children]){this.contours.remove(child);child.geometry.dispose();child.material.dispose();}
   const h=m.height_cm/100;
   for(const [key,y,color]of [['bust',.735,0x957bea],['waist',.635,0xe77c42],['hip',.525,0x57977f]]){
     const points=[],sy=this.landmarkY(y);
     const cut=slice(this.geometry.attributes.position.array,this.surface.indices,sy);
     for(const[a,b]of cut.segments){for(const p of[a,b])points.push(p[0]*1.006,p[1],p[2]*1.006+.0005);}
     const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
     const line=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color,transparent:true,opacity:.8,depthTest:false}));line.renderOrder=3;this.contours.add(line);
   }
 }
 setRotating(value){this.rotating=value;}
 wear(product,size){
   if(!this.ready)throw new Error('The body preview is still loading.');
   garmentSize(product,size);const fit=garmentFit(product,size,this.measurements);if(!fit.canWear)throw new Error(fit.message);
   const slot=product.category==='pants'?'bottom':'top';this.outfit||={};
   const previous=this.outfit[slot];if(previous?.model){this.bodyGroup.remove(previous.model.group);disposeGarment(previous.model);}
   this.outfit[slot]={product,size};updateOutfit(this);this.onOutfitChange?.();
 }
 removeGarment(slot){
   const item=this.outfit?.[slot];if(item?.model){this.bodyGroup.remove(item.model.group);disposeGarment(item.model);}
   if(this.outfit)delete this.outfit[slot];updateOutfit(this);this.onOutfitChange?.();
 }
 setContours(value){this.contoursVisible=value;this.contours.visible=value;}
 setView(name){this.setRotating(false);this.targetAngle=({front:0,side:Math.PI/2,back:Math.PI})[name]??0;this.pitch=0;}
 reset(){this.targetAngle=.18;this.pitch=0;this.zoom=1;this.rotating=false;}
 resize(){const w=this.container.clientWidth,h=this.container.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
 animate(){
   this.frame=requestAnimationFrame(()=>this.animate());const dt=Math.min(this.clock.getDelta(),.05);
   if(this.rotating)this.targetAngle+=dt*.3;this.angle=lerp(this.angle,this.targetAngle,.12);this.bodyGroup.rotation.y=this.angle;
   const h=this.bodyHeight||1.65;this.camera.position.set(0,h*.53+this.pitch,h*2.55*this.zoom);this.camera.lookAt(0,h*.44,0);this.renderer.render(this.scene,this.camera);
 }
 dispose(){cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();for(const item of Object.values(this.outfit||{}))disposeGarment(item.model);disposeUndergarments(this);this.geometry?.dispose();this.material?.dispose();this.renderer.dispose();}
}
