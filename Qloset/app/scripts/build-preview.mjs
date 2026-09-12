import {readFile,writeFile} from 'node:fs/promises';
const base=new URL('../',import.meta.url),read=path=>readFile(new URL(path,base),'utf8');
const three=await read('dist/vendor/three.module.js'),match=three.match(/export\{([^}]+)\};?\s*$/);
if(!match)throw new Error('Cannot bundle Three.js export table.');
const table=match[1].split(',').map(item=>{const[a,b]=item.trim().split(/\s+as\s+/);return b?`${b}:${a}`:a;}).join(',');
const modules=[
  ['measurements','DEFAULT_PROFILE,PRESETS,CHOICES,validateProfile,estimateMeasurements,MODEL_NOTE'],
  ['catalog','loadCatalog'],
  ['recommendations','CATEGORY_LABELS,buildRecommendationRequest,buildModelPayload,createDemoRecommendations'],
  ['undergarments','applyUndergarments,disposeUndergarments'],
  ['garment-model','updateOutfit,disposeGarment,garmentFit,garmentSize,suggestedSize,GARMENT_NOTE'],
  ['body-viewer','BodyViewer,SKIN_TONES,DEFAULT_SKIN_TONE'],
  ['wardrobe','mountWardrobe'],
  ['recommendation-panel','mountRecommendations'],
];
let script=`(async()=>{const THREE=(()=>{${three.slice(0,match.index)}return {${table}};})();`;
for(const[name,exports]of modules){
  let code=(await read(`dist/${name}.js`)).replace(/^import[^\n]+\n/gm,'').replaceAll('export ','');
  if(name==='body-viewer')code=code.replace("const response=await fetch('./body.json');if(!response.ok)throw new Error('The body model could not load. Please retry.');this.data=await response.json();",`this.data=${(await read('dist/body.json')).trim()};`);
  if(name==='catalog')code=`function loadCatalog(){return Promise.resolve(${(await read('dist/data/products.json')).trim()});}`;
  if(name==='recommendation-panel')code=code.replace("if(location.protocol!=='file:'){","if(false){");
  script+=`const {${exports}}=(()=>{${code}\nreturn {${exports}};})();`;
}
script+=(await read('dist/app.js')).replace(/^import[^\n]+\n/gm,'')+'})();';
let output=await read('dist/index.html');
for(const name of ['style','recommendations','wardrobe'])output=output.replace(`<link rel="stylesheet" href="./${name}.css">`,`<style>${(await read(`dist/${name}.css`)).replace(/^@import[^\n]+\n/,'')}</style>`);
output=output.replace('<script type="module" src="./app.js"></script>',()=>`<script>${script.replaceAll('</script','<\\/script')}</script>`).replace('href="./favicon.svg"','href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Crect width=%2232%22 height=%2232%22 rx=%228%22 fill=%22%23eb673d%22/%3E%3C/svg%3E"');
await writeFile(new URL('Qloset.html',base),output);console.log(`Created standalone Qloset.html (${output.length} bytes)`);
