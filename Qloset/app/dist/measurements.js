// A replaceable visual model for the demo, not a validated anthropometric predictor.
// Keep broad heritage categories neutral. Cup labels without a band measurement
// inform only relative shape; the bust value remains an estimate.
export const DEFAULT_PROFILE = {height_cm:165,weight_kg:62,gender:'female',ancestry:'mixed',body_shape:'hourglass',belly:'average',build:'average',legs:'average',arms:'average',cup_size:'C'};
export const CHOICES = {
 gender:['female','male'],ancestry:['mixed','african','asian','european'],
 body_shape:['rectangle','pear','apple','hourglass','inverted_triangle','unsure'],
 belly:['flat','average','prominent'],build:['soft','average','athletic'],
 legs:['short','average','long'],arms:['short','average','long'],cup_size:['A','B','C','D','DD','F']
};
export const PRESETS = [
 {name:'Petite',height_cm:155,weight_kg:50,gender:'female',body_shape:'rectangle',cup_size:'B'},
 {name:'Hourglass',height_cm:165,weight_kg:62,gender:'female',body_shape:'hourglass',cup_size:'C'},
 {name:'Curvy',height_cm:168,weight_kg:82,gender:'female',body_shape:'pear',build:'soft',cup_size:'D'},
 {name:'Athletic',height_cm:180,weight_kg:82,gender:'male',body_shape:'inverted_triangle',build:'athletic',belly:'flat'},
 {name:'Average',height_cm:175,weight_kg:78,gender:'male',body_shape:'rectangle'},
 {name:'Stocky',height_cm:170,weight_kg:95,gender:'male',body_shape:'apple',build:'soft',belly:'prominent'}
];
export function validateProfile(value){
 if(!value||typeof value!=='object'||Array.isArray(value)) throw new Error('Provide a body profile.');
 const p={...DEFAULT_PROFILE,...value};
 for(const [key,min,max] of [['height_cm',140,220],['weight_kg',35,200]]){
   if(typeof p[key]!=='number'||!Number.isFinite(p[key])||p[key]<min||p[key]>max) throw new Error(`${key==='height_cm'?'Height':'Weight'} must be between ${min} and ${max} ${key==='height_cm'?'cm':'kg'}.`);
 }
 for(const [key,options] of Object.entries(CHOICES))if(!options.includes(p[key]))throw new Error(`Choose a valid ${key.replaceAll('_',' ')}.`);
 for(const key of Object.keys(value))if(!(key in DEFAULT_PROFILE))throw new Error(`Unknown profile field: ${key}.`);
 return p;
}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function estimateMeasurements(input){
 const p=validateProfile(input),h=p.height_cm,bmi=p.weight_kg/(h/100)**2,d=bmi-22,male=p.gender==='male';
 let bust=h*.535+d*1.55+(male?5:0),waist=h*.44+d*2.0+(male?4:0),hip=h*.57+d*1.5+(male?-4:0);
 let shoulder=h*(male?.243:.226),thigh=h*.321+d*.82,arm=h*.16+d*.46;
 const shapes={rectangle:[0,2,-1,0],pear:[-2,-2,6,-1],apple:[2,0,-1,0],hourglass:[2,-4,4,0],inverted_triangle:[4,0,-3,2],unsure:[0,0,0,0]};
 const s=shapes[p.body_shape];bust+=s[0];waist+=s[1];hip+=s[2];shoulder+=s[3];
 // Apple and belly share one central-prominence channel.
 waist+=p.belly==='flat'?-3:p.belly==='prominent'||p.body_shape==='apple'?7:0;
 if(p.build==='athletic'){bust+=2;waist-=2;shoulder+=1.5;thigh+=1.5;arm+=2;}
 if(p.build==='soft'){waist+=2;hip+=1.5;arm+=.5;}
 const inseam=h*({short:.445,average:.47,long:.495})[p.legs];
 const sleeve=h*(male?.34:.33)*({short:.94,average:1,long:1.06})[p.arms];
 const round=n=>Math.round(n*10)/10;
 return Object.fromEntries(Object.entries({height_cm:h,weight_kg:p.weight_kg,bust_cm:clamp(bust,65,175),waist_cm:clamp(waist,52,185),hip_cm:clamp(hip,70,180),shoulder_width_cm:shoulder,inseam_cm:inseam,sleeve_length_cm:sleeve,thigh_cm:clamp(thigh,36,100),upper_arm_cm:clamp(arm,19,60),underbust_cm:bust-(male?3:12),neck_cm:h*(male?.22:.20)+d*.25,belly_depth_cm:({flat:0,average:1,prominent:3})[p.belly]}).map(([k,n])=>[k,round(n)]));
}
export const MODEL_NOTE='Approximate body preview. Model dimensions are illustrative, not measured from your body.';
