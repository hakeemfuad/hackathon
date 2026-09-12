import {DEFAULT_PROFILE,PRESETS,CHOICES,validateProfile,estimateMeasurements,MODEL_NOTE} from './measurements.js';
import {BodyViewer,SKIN_TONES,DEFAULT_SKIN_TONE} from './body-viewer.js';
import {mountWardrobe} from './wardrobe.js';
import {mountRecommendations} from './recommendation-panel.js';
const icon=(name)=>({spark:'<path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3Z"/>',reset:'<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',rotate:'<path d="M18 7c2 1 3 3 3 5 0 4-4 7-9 7s-9-3-9-7 4-7 9-7h4m-3-3 3 3-3 3"/>',rings:'<ellipse cx="12" cy="7" rx="9" ry="3"/><path d="M3 12c0 4 18 4 18 0M3 17c0 4 18 4 18 0"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',check:'<path d="m5 12 4 4L19 6"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',chevron:'<path d="m6 9 6 6 6-6"/>'})[name]||'';
const svg=(name)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon(name)}</svg>`;
const inches=cm=>cm/2.54;
const pounds=kg=>kg/0.45359237;
const heightText=cm=>{const total=Math.round(inches(cm)*10)/10;const feet=Math.floor(total/12),remaining=Math.round((total-feet*12)*10)/10;return `${feet}′ ${remaining}″`;};
const labels={female:'Female',male:'Male',mixed:'Prefer not to say',african:'African / Caribbean',asian:'Asian / Pacific Islander',european:'European / Middle Eastern',rectangle:'Rectangle',pear:'Pear',apple:'Apple',hourglass:'Hourglass',inverted_triangle:'Inv. Triangle',unsure:'Not sure',flat:'Flat',average:'Average',prominent:'Prominent',soft:'Soft',athletic:'Athletic',short:'Short',long:'Long'};
const shapeSvg=(s)=>{const paths={rectangle:'M10 4h20l1 29H9Z',pear:'M13 4h14l-2 11c12 11 10 18-5 18S3 26 15 15Z',apple:'M13 4h14c1 8 8 13 7 20-1 12-27 12-28 0C5 17 12 12 13 4Z',hourglass:'M10 4h20c0 8-7 11-7 15s8 8 8 14H9c0-6 8-10 8-14S10 12 10 4Z',inverted_triangle:'M5 4h30l-7 15-4 14h-8l-4-14Z',unsure:'M14 12c0-9 14-9 14-1 0 6-8 5-8 12m0 7v1'};return `<svg viewBox="0 0 40 38" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="${paths[s]}"/></svg>`};
const options=(key,title,shape=false)=>`<fieldset class="field ${shape?'shape-field':''}"><legend>${title}</legend><div class="choices ${shape?'shapes':''}" data-key="${key}">${CHOICES[key].map(value=>`<label class="choice"><input type="radio" name="${key}" value="${value}" ${DEFAULT_PROFILE[key]===value?'checked':''}>${shape?shapeSvg(value):''}<span>${labels[value]||value}</span></label>`).join('')}</div></fieldset>`;

document.querySelector('#app').innerHTML=`
 <header class="topbar"><a class="brand" href="./" aria-label="Qloset body studio"><span class="brand-mark">q</span>qloset<span class="brand-period">.</span></a><span class="workspace-name">Body studio</span><span class="demo-badge">TECH DEMO <span>01</span></span></header>
 <div class="workspace">
 <aside class="profile-panel" aria-label="Body questionnaire"><div class="panel-heading"><div class="eyebrow">01 / YOUR PROFILE</div><h1>A few details.<br>A body that's yours.</h1><p>Start with your measurements and proportions.</p></div>
 <form id="profile-form"><div class="form-scroll">
 <div class="number-pair"><fieldset class="field height-field"><legend>Height</legend><div class="height-inputs"><label class="number-input"><input name="height_ft" aria-label="Height in feet" type="number" min="4" max="7" step="1" value="5" required inputmode="numeric"><span>ft</span></label><label class="number-input"><input name="height_in" aria-label="Additional height in inches" type="number" min="0" max="11.9" step="0.1" value="5" required inputmode="decimal"><span>in</span></label></div></fieldset><label class="field">Weight<div class="number-input"><input name="weight_lb" type="number" min="77.2" max="440.9" step="0.1" value="136.7" required inputmode="decimal"><span>lb</span></div></label></div>
 ${options('gender','Gender')}
 <label class="field heritage">Heritage<select name="ancestry">${CHOICES.ancestry.map(v=>`<option value="${v}">${labels[v]}</option>`).join('')}</select></label>
 ${options('body_shape','Body shape',true)}
 ${options('belly','Belly')}${options('build','Build')}${options('legs','Legs')}${options('arms','Arms')}
 <div id="cup-field">${options('cup_size','Cup size')}<p class="field-note">Cup size also needs a band size to affect this preview.</p></div>
 </div><div class="form-bottom"><p id="form-error" class="error" role="alert" hidden></p><button class="generate-button" type="submit" id="generate">${svg('spark')}<span>Generate body</span>${svg('arrow')}</button><p class="form-footnote">No photos. Just your proportions.</p></div></form></aside>
 <section class="studio" aria-labelledby="studio-title"><div class="studio-heading"><div><div class="eyebrow">02 / YOUR DIGITAL FORM</div><h2 id="studio-title">Meet your body.</h2></div><span class="estimate-badge">Estimated model</span></div>
 <div class="presets"><span>Try a profile</span><div class="preset-buttons">${PRESETS.map(p=>`<button type="button" data-preset="${p.name}" class="preset ${p.name==='Hourglass'?'active':''}">${p.name}</button>`).join('')}</div></div>
 <div class="skin-tone-control" role="radiogroup" aria-labelledby="skin-tone-label"><div class="skin-tone-heading"><span id="skin-tone-label">Skin tone</span><span id="skin-tone-name">${SKIN_TONES.find(tone=>tone.id===DEFAULT_SKIN_TONE).label}</span></div><div class="skin-tone-options">${SKIN_TONES.map((tone,index)=>`<label class="skin-tone-option" title="${tone.label}" style="--skin-tone:${tone.color};--swatch-ink:${index<4?'#493126':'#fff8f0'}"><input type="radio" name="skin_tone" value="${tone.id}" aria-label="${tone.label}" ${tone.id===DEFAULT_SKIN_TONE?'checked':''}><span class="skin-tone-swatch" aria-hidden="true">${svg('check')}</span></label>`).join('')}</div></div>
 <div class="fitting-workspace"><div class="stage"><div id="viewer"></div><div class="viewer-loading" id="viewer-loading"><span class="loader"></span><span>Preparing your body…</span></div><div class="viewer-message" id="viewer-error" role="alert" hidden></div>
 <div class="height-guide" aria-hidden="true"><span id="height-label">5′ 5″</span><div class="guide-line"></div></div>
 <div class="viewer-toolbar"><button type="button" id="toggle-rotation" class="icon-button" title="Auto-rotate" aria-label="Auto-rotate body" aria-pressed="false">${svg('rotate')}</button><button type="button" id="toggle-contours" class="icon-button selected" title="Measurement contours" aria-label="Show measurement contours" aria-pressed="true">${svg('rings')}</button><span></span><button type="button" id="reset-view" class="icon-button" title="Reset view" aria-label="Reset view">${svg('reset')}</button></div>
 <div class="view-control" role="group" aria-label="Body view"><button class="active" data-view="front">Front</button><button data-view="side">Side</button><button data-view="back">Back</button></div>
 <div class="stage-caption">Drag to rotate <span>·</span> Scroll to zoom</div><div class="model-status" id="model-status" role="status" aria-live="polite">Sample profile · 5′ 5″ / 137 lb</div></div>
 <aside class="wardrobe-panel" aria-label="Fitting room"></aside></div>
 <section class="measurements" aria-label="Estimated measurements"><div class="measurement-heading"><h3>Your proportions</h3><span>All measurements in inches</span></div><div class="primary-measurements" id="primary-measurements"></div><details class="all-measurements"><summary>More measurements ${svg('chevron')}</summary><dl id="measurement-details"></dl></details><p class="estimate-note">${svg('info')}<span>${MODEL_NOTE}</span></p></section>
 <section class="recommendation-panel" aria-label="Clothing recommendations"></section>
 </section></div>`;

// A native modal keeps the studio inert and keyboard focus inside the introduction.
const introduction=document.createElement('dialog');
introduction.className='intro-dialog';
introduction.setAttribute('aria-labelledby','intro-title');
introduction.setAttribute('aria-describedby','intro-synopsis');
introduction.innerHTML=`
 <div class="intro-content">
  <button class="intro-close" type="button" aria-label="Close introduction"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
  <div class="intro-eyebrow"><span class="brand-mark" aria-hidden="true"></span>WELCOME TO QLOSET</div>
  <h2 id="intro-title" tabindex="-1" autofocus>Great style starts<br>with <span>confidence.</span></h2>
  <p id="intro-synopsis">Your digital fitting room, built around you. Explore a 3D preview of your proportions, try on clothing, and compare sizes to make more informed decisions before you buy.</p>
  <div class="intro-stat"><strong>1 in 5</strong><div><h3>Fashion has a returns problem.</h3><p>An estimated 20% of clothing bought online in Europe is returned. Uncertainty about fit and style is a major driver.</p><a href="https://www.eea.europa.eu/en/newsroom/news/many-returned-and-unsold-textiles" target="_blank" rel="noopener noreferrer">Source: European Environment Agency, 2024 ↗</a></div></div>
  <h3 class="intro-wins-title">Our goal? A win for everyone.</h3>
  <div class="intro-wins">
   <section><span class="intro-benefit-label">01 / FOR YOU</span><h4>Buy with confidence.</h4><p>Understand your proportions and explore your options, with less guesswork and fewer return trips.</p></section>
   <section><span class="intro-benefit-label">02 / FOR BUSINESSES</span><h4>More keepers. Fewer returns.</h4><p>Better purchasing decisions can mean fewer costly returns, happier customers, and stronger loyalty.</p></section>
   <section><span class="intro-benefit-label">03 / FOR THE PLANET</span><h4>Less waste. More wear.</h4><p>Fewer avoidable returns can reduce extra shipping, packaging waste, and the risk of unworn clothing being discarded.</p></section>
  </div>
  <div class="intro-footer"><p>Thoughtful choices.<br>A wardrobe worth keeping.</p><button type="button" class="intro-enter">Enter the studio ${svg('arrow')}</button></div>
 </div>`;
document.body.append(introduction);
introduction.addEventListener('close',()=>{
 document.body.classList.remove('intro-open');
 document.querySelector('.brand').focus({preventScroll:true});
});
introduction.querySelector('.intro-close').addEventListener('click',()=>introduction.close());
introduction.querySelector('.intro-enter').addEventListener('click',()=>introduction.close());
let backdropPointerDown=false;
const isBackdrop=event=>{const r=introduction.getBoundingClientRect();return event.target===introduction&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom);};
introduction.addEventListener('pointerdown',event=>{backdropPointerDown=isBackdrop(event);});
introduction.addEventListener('pointerup',event=>{if(backdropPointerDown&&isBackdrop(event))introduction.close();backdropPointerDown=false;});
document.body.classList.add('intro-open');
introduction.showModal();

const form=document.querySelector('#profile-form');let current={...DEFAULT_PROFILE},measurements=estimateMeasurements(current),viewer;
const wardrobe=mountWardrobe(document.querySelector('.wardrobe-panel'),()=>viewer,()=>measurements);
const recommendations=mountRecommendations(document.querySelector('.recommendation-panel'),()=>measurements,(id,size)=>wardrobe.tryOn(id,size));
document.querySelector('.skin-tone-control').addEventListener('change',event=>{
 const tone=SKIN_TONES.find(option=>option.id===event.target.value);
 if(!tone)return;
 viewer?.setSkinTone(tone.id);
 document.querySelector('#skin-tone-name').textContent=tone.label;
});
const measureNames={bust_cm:'Bust',waist_cm:'Waist',hip_cm:'Hip',thigh_cm:'Thigh',upper_arm_cm:'Upper arm',shoulder_width_cm:'Shoulder width',sleeve_length_cm:'Sleeve length',inseam_cm:'Inseam'};
function renderMeasurements(m){
 document.querySelector('#primary-measurements').innerHTML=['bust_cm','waist_cm','hip_cm'].map(key=>`<div class="metric ${key.split('_')[0]}"><div><i></i>${measureNames[key]}</div><p>${inches(m[key]).toFixed(1)}<span>in</span></p></div>`).join('');
 document.querySelector('#measurement-details').innerHTML=Object.keys(measureNames).slice(3).map(key=>`<div><dt>${measureNames[key]}</dt><dd>${inches(m[key]).toFixed(1)}<span> in</span></dd></div>`).join('');
 document.querySelector('#height-label').textContent=heightText(m.height_cm);
}
function setForm(p){for(const[key,value]of Object.entries(p)){const field=form.elements.namedItem(key);if(field)field.value=String(value);}const total=Math.round(inches(p.height_cm)*10)/10;form.elements.height_ft.value=Math.floor(total/12);form.elements.height_in.value=(total%12).toFixed(1);form.elements.weight_lb.value=pounds(p.weight_kg).toFixed(1);document.querySelector('#cup-field').hidden=p.gender==='male';}
function readForm(){const d=Object.fromEntries(new FormData(form)),{height_ft,height_in,weight_lb,...fields}=d;const ft=Number(height_ft),inch=Number(height_in),lb=Number(weight_lb);if(!Number.isInteger(ft)||ft<4||ft>7||inch<0||inch>=12)throw new Error('Enter feet and additional inches (0–11.9).');const cm=(ft*12+inch)*2.54;if(cm<140||cm>220)throw new Error('Height must be between 4′ 7.2″ and 7′ 2.6″.');if(lb<77.2||lb>440.9)throw new Error('Weight must be between 77.2 and 440.9 lb.');return validateProfile({...fields,height_cm:cm,weight_kg:lb*0.45359237});}
function setPresetActive(name){document.querySelectorAll('[data-preset]').forEach(b=>{b.classList.toggle('active',b.dataset.preset===name);b.setAttribute('aria-pressed',String(b.dataset.preset===name));});}
function generate(profile,label,{syncForm=true}={}){
 const p=validateProfile(profile),m=estimateMeasurements(p);
 if(!viewer?.ready)throw new Error('The 3D model is still loading. Please try again in a moment.');
 viewer.update(p,m);current=p;measurements=m;renderMeasurements(m);wardrobe.update();recommendations.update();if(syncForm)setForm(p);
 document.querySelector('#model-status').textContent=`${label||'Your profile'} · ${heightText(p.height_cm)} / ${Math.round(pounds(p.weight_kg))} lb`;
 document.querySelector('#form-error').hidden=true;document.querySelector('#generate span').textContent='Update body';
 if(!label)setPresetActive(null);
 return {profile:{...current},measurements:{...measurements},method:'illustrative_estimate',note:MODEL_NOTE};
}
form.addEventListener('submit',e=>{e.preventDefault();clearTimeout(liveUpdateTimer);try{generate(readForm());}catch(error){const el=document.querySelector('#form-error');el.textContent=error.message;el.hidden=false;}});
let liveUpdateTimer,pendingProfile;
form.addEventListener('input',event=>{
 clearTimeout(liveUpdateTimer);setPresetActive(null);wardrobe.invalidate();recommendations.invalidate();
 document.querySelector('#cup-field').hidden=form.elements.namedItem('gender').value==='male';
 const update=()=>{
   try{if(!form.checkValidity()){document.querySelector('#model-status').textContent='Complete your height and weight to update';return;}const p=readForm();if(!viewer?.ready){pendingProfile=p;return;}generate(p,undefined,{syncForm:false});}
   catch(error){document.querySelector('#model-status').textContent='Complete your height and weight to update';}
 };
 if(event.target.type==='number'){document.querySelector('#model-status').textContent='Updating your profile…';liveUpdateTimer=setTimeout(update,250);}
 else update();
});
document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{clearTimeout(liveUpdateTimer);const preset=PRESETS.find(p=>p.name===b.dataset.preset);const {name,...values}=preset;try{generate({...DEFAULT_PROFILE,...values},name);setPresetActive(name);}catch(error){document.querySelector('#model-status').textContent=error.message;}}));
document.querySelector('#toggle-rotation').addEventListener('click',()=>{if(!viewer)return;viewer.setRotating(!viewer.rotating);syncRotation();});
const syncRotation=()=>{const b=document.querySelector('#toggle-rotation');b.classList.toggle('selected',viewer.rotating);b.setAttribute('aria-pressed',String(viewer.rotating));};
document.querySelector('#toggle-contours').addEventListener('click',e=>{if(!viewer)return;viewer.setContours(!viewer.contoursVisible);e.currentTarget.classList.toggle('selected',viewer.contoursVisible);e.currentTarget.setAttribute('aria-pressed',String(viewer.contoursVisible));});
document.querySelector('#reset-view').addEventListener('click',()=>{viewer?.reset();syncRotation();document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view==='front'));});
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{viewer?.setView(b.dataset.view);syncRotation();document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x===b));}));
renderMeasurements(measurements);setForm(current);
try{viewer=new BodyViewer(document.querySelector('#viewer'));viewer.onOutfitChange=()=>wardrobe.update();viewer.onInteraction=()=>{syncRotation();document.querySelectorAll('[data-view]').forEach(b=>b.classList.remove('active'));};await viewer.load();if(pendingProfile)generate(pendingProfile,undefined,{syncForm:false});else viewer.update(current,measurements);wardrobe.update();document.querySelector('#viewer-loading').hidden=true;}
catch(error){document.querySelector('#viewer-loading').hidden=true;const el=document.querySelector('#viewer-error');el.hidden=false;el.textContent='3D preview could not load. Reload this page to try again.';document.querySelector('#generate').disabled=true;console.error(error);}

const modelContext=document.modelContext;
if(modelContext?.registerTool){
 const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
 const properties={height_cm:{type:'number',minimum:140,maximum:220},weight_kg:{type:'number',minimum:35,maximum:200},...Object.fromEntries(Object.entries(CHOICES).map(([key,values])=>[key,{type:'string',enum:values}]))};
 const tools=[{name:'generate_body',title:'Generate body',description:'Apply questionnaire answers and generate the visible 3D body and estimated measurements. Unspecified fields use the current profile.',inputSchema:{type:'object',properties,additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Provide an object of profile fields.');return generate({...current,...input});}},
 {name:'read_body_profile',title:'Read body profile',description:'Read the current generated body profile, estimated measurements, and model limitations.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){if(input&&Object.keys(input).length)throw new Error('This tool takes no arguments.');return {profile:{...current},measurements:{...measurements},method:'illustrative_estimate',note:MODEL_NOTE};}}];
 for(const tool of tools){try{Promise.resolve(modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(error=>console.warn('Body tool unavailable',error));}catch(error){console.warn('Body tool unavailable',error);}}
}
