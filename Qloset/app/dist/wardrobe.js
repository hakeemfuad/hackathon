import {loadCatalog} from './catalog.js';
import {CATEGORY_LABELS} from './recommendations.js';
import {garmentFit,garmentSize,suggestedSize,GARMENT_NOTE} from './garment-model.js';

const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;};
const label=key=>({upper_arm:'Upper arm',shoulder_width:'Shoulder',sleeve_length:'Sleeve',leg_opening:'Leg opening',neck_width:'Neck width',neck_depth:'Neck depth',hood_height:'Hood height',hood_width:'Hood width'}[key]||key[0].toUpperCase()+key.slice(1));
export function mountWardrobe(container,getViewer,getMeasurements){
  container.innerHTML=`<div class="wardrobe-heading"><div class="eyebrow">03 / THE FITTING ROOM</div><h3>Dress your body.</h3><p>Explore 40 sample pieces in 3D.</p></div>
    <div class="wardrobe-fields"><label>Category<select id="garment-category">${Object.entries(CATEGORY_LABELS).map(([key,value])=>`<option value="${key}" ${key==='short_sleeve_shirt'?'selected':''}>${value}</option>`).join('')}</select></label>
    <label>Garment<select id="garment-product" disabled><option>Loading garments…</option></select></label></div>
    <div class="garment-description"><span class="garment-swatch" aria-hidden="true"></span><p id="garment-fabric"></p></div>
    <div class="size-heading"><span>Size</span><span id="garment-size-count"></span></div><div class="garment-sizes" role="group" aria-label="Garment size"></div>
    <p id="garment-fit" role="status" aria-live="polite"></p><button class="wear-garment" type="button" disabled>Try on this garment</button>
    <details class="garment-chart"><summary>Size measurements <span>inches</span></summary><dl></dl><details class="construction-chart"><summary>Sample construction</summary><dl></dl><p>Illustrative dimensions added for the 3D shape.</p></details></details>
    <div class="outfit-heading"><h4>On your body</h4><button class="clear-outfit" type="button" hidden>Clear outfit</button></div><div class="outfit-items"></div>
    <p class="garment-disclaimer">${GARMENT_NOTE}</p>`;
  let catalog,product,size,dirty=false;
  const category=container.querySelector('#garment-category'),products=container.querySelector('#garment-product'),sizes=container.querySelector('.garment-sizes'),fit=container.querySelector('#garment-fit'),wear=container.querySelector('.wear-garment');
  const drawDimensions=(target,dimensions)=>{target.replaceChildren();for(const [key,value]of Object.entries(dimensions)){const row=el('div');row.append(el('dt','',label(key)),el('dd','',`${Number(value).toFixed(1)} in`));target.append(row);}};
  function renderSelection(){
    if(!product)return;const entry=garmentSize(product,size),assessment=garmentFit(product,size,getMeasurements());
    container.querySelector('#garment-fabric').textContent=product.fabric;
    container.querySelector('.garment-swatch').style.backgroundColor=product.render.color;
    container.querySelector('#garment-size-count').textContent=`${product.sizes.length} sizes`;
    for(const b of sizes.children)b.setAttribute('aria-pressed',String(b.dataset.size===size));
    const worn=Object.values(getViewer()?.outfit||{}).find(g=>g.product.id===product.id&&g.size===size&&g.model);
    wear.disabled=dirty||!getViewer()?.ready||!assessment.canWear||Boolean(worn);
    wear.textContent=worn?`Wearing size ${size}`:'Try on this garment';
    fit.textContent=dirty?'Complete your profile to try on a garment.':!getViewer()?.ready?'Waiting for the body preview…':assessment.message;
    fit.classList.toggle('size-unavailable',!assessment.canWear);
    drawDimensions(container.querySelector('.garment-chart > dl'),entry.measurements);
    drawDimensions(container.querySelector('.construction-chart dl'),entry.render_dimensions);
  }
  function chooseProduct(id,requestedSize){
    product=catalog.products.find(p=>p.id===id);size=requestedSize||suggestedSize(product,getMeasurements());
    products.value=product.id;sizes.replaceChildren();
    for(const entry of product.sizes){const button=el('button','',entry.size);button.type='button';button.dataset.size=entry.size;button.setAttribute('aria-label',`Size ${entry.size}`);button.addEventListener('click',()=>{size=entry.size;renderSelection();});sizes.append(button);}
    renderSelection();
  }
  function populate(){
    products.replaceChildren();for(const p of catalog.products.filter(p=>p.category===category.value)){const option=el('option','',p.name);option.value=p.id;products.append(option);}products.disabled=false;chooseProduct(products.value);
  }
  function renderOutfit(){
    const items=container.querySelector('.outfit-items'),outfit=getViewer()?.outfit||{};items.replaceChildren();
    const entries=Object.entries(outfit);container.querySelector('.clear-outfit').hidden=!entries.length;
    if(!entries.length)items.append(el('p','outfit-empty','Choose a top and pants to build an outfit.'));
    for(const [slot,item]of entries){const row=el('div','outfit-item'),copy=el('div'),swatch=el('span','garment-swatch');swatch.style.backgroundColor=item.product.render.color;
      copy.append(el('strong','',item.product.name),el('span','',`Size ${item.size}${item.model?'':' · too small for this profile'}`));const remove=el('button','remove-garment','Remove');remove.type='button';remove.setAttribute('aria-label',`Remove ${item.product.name}`);remove.addEventListener('click',()=>getViewer().removeGarment(slot));row.append(swatch,copy,remove);items.append(row);
    }
    renderSelection();
  }
  category.addEventListener('change',()=>{if(catalog)populate();});products.addEventListener('change',()=>chooseProduct(products.value));
  wear.addEventListener('click',()=>{
    try{getViewer().wear(product,size);getViewer().setContours(false);const contours=document.querySelector('#toggle-contours');contours.classList.remove('selected');contours.setAttribute('aria-pressed','false');renderOutfit();if(matchMedia('(max-width:1250px)').matches)document.querySelector('.fitting-workspace').scrollIntoView({behavior:'smooth',block:'start'});}
    catch(error){fit.textContent=error.message;}
  });
  container.querySelector('.clear-outfit').addEventListener('click',()=>{for(const slot of Object.keys(getViewer().outfit||{}))getViewer().removeGarment(slot);});
  const ready=loadCatalog().then(data=>{catalog=data;populate();renderOutfit();}).catch(error=>{fit.textContent=error.message;products.replaceChildren(el('option','','Catalog unavailable'));});
  return {ready,update(){dirty=false;renderOutfit();},invalidate(){dirty=true;renderSelection();},async tryOn(id,label){await ready;if(!catalog)throw new Error('The sample catalog is unavailable.');const p=catalog.products.find(p=>p.id===id);if(!p)throw new Error('This garment is not in the sample catalog.');category.value=p.category;populate();chooseProduct(id,label);if(dirty)throw new Error('Complete your body profile first.');getViewer().wear(p,label);getViewer().setContours(false);document.querySelector('#toggle-contours').classList.remove('selected');document.querySelector('#toggle-contours').setAttribute('aria-pressed','false');renderOutfit();document.querySelector('.fitting-workspace').scrollIntoView({behavior:'smooth',block:'start'});}};
}
