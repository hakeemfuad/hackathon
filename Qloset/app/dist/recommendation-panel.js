import {CATEGORY_LABELS,buildRecommendationRequest,buildModelPayload,createDemoRecommendations} from './recommendations.js';
import {loadCatalog} from './catalog.js';
const make=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};

export function mountRecommendations(container,getMeasurements,onTryOn){
  container.innerHTML=`<div class="recommendation-heading"><div><div class="eyebrow">04 / FIND YOUR FIT</div><h2>Find your next fit.</h2></div><span class="catalog-badge">40 sample pieces</span></div>
    <p class="recommendation-intro">Choose what you're looking for. Compare your estimated measurements with each garment's dimensions.</p>
    <form id="recommendation-form">
      <div class="recommendation-controls"><label>Looking for<select name="category">${Object.entries(CATEGORY_LABELS).map(([key,value])=>`<option value="${key}" ${key==='short_sleeve_shirt'?'selected':''}>${value}</option>`).join('')}</select></label>
      <label>Preferred fit<select name="fit"><option value="slim">Close-fitting</option><option value="regular" selected>Regular</option><option value="relaxed">Relaxed</option></select></label></div>
      <label class="request-label" for="shopping-request">Anything else? <span>Optional</span></label><textarea id="shopping-request" name="query" maxlength="500" rows="2" placeholder="A relaxed everyday shirt for layering, in a lightweight fabric"></textarea>
      <div class="recommendation-action"><button type="submit" class="find-matches" disabled>Find my matches</button><span id="recommendation-provider">Loading sample catalog…</span></div>
      <p class="recommendation-data-note" id="recommendation-data-note"></p>
    </form>
    <p id="recommendation-status" role="status" aria-live="polite"></p><div id="recommendation-results"></div>
    <details class="payload-details" hidden><summary>View recommendation payload</summary><p>Estimated body measurements, preferences, sample garments, and fit comparisons. All dimensions are in inches.</p><button type="button" class="download-payload">Download JSON</button><pre tabindex="0" aria-label="Recommendation payload JSON"></pre></details>`;
  const form=container.querySelector('form'),button=form.querySelector('button'),status=container.querySelector('#recommendation-status'),results=container.querySelector('#recommendation-results');
  const payloadDetails=container.querySelector('.payload-details');
  let catalog=null,apiAvailable=false,provider='demo',profileDirty=false,requestVersion=0,controller=null,currentPayload=null;
  function clear(){requestVersion++;controller?.abort();results.replaceChildren();status.textContent='';currentPayload=null;payloadDetails.hidden=true;button.textContent='Find my matches';button.disabled=!catalog||profileDirty;results.removeAttribute('aria-busy');}
  function render(result){
    results.replaceChildren();
    results.append(make('p','recommendation-summary',result.summary));
    const grid=make('div','recommendation-grid');
    for(const item of result.recommendations){
      const card=make('article','product-match'),meta=make('div','product-match-meta');
      meta.append(make('span','',CATEGORY_LABELS[item.product.category]),make('span','size-chip',`Size ${item.size}`));
      card.append(meta,make('h3','',item.product.name),make('p','product-fabric',item.product.fabric),make('p','product-reason',item.reason));
      if(item.comparisons.length){
        const comparison=make('details','fit-comparisons');comparison.append(make('summary','','Compare measurements'));
        const table=make('table','');table.innerHTML='<thead><tr><th scope="col">Inches</th><th scope="col">Body</th><th scope="col">Garment</th><th scope="col">Room</th></tr></thead>';
        const tbody=make('tbody','');for(const c of item.comparisons){const row=make('tr','');const heading=make('th','',c.measurement.replaceAll('_',' '));heading.scope='row';row.append(heading);for(const n of [c.body_inches,c.garment_inches,c.ease_inches])row.append(make('td','',Number(n).toFixed(1)));tbody.append(row);}table.append(tbody);comparison.append(table);card.append(comparison);
      }
      if(item.warnings.length){const notes=make('details','match-warnings');notes.append(make('summary','','Fit notes'));const list=make('ul','');for(const note of item.warnings)list.append(make('li','',note));notes.append(list);card.append(notes);}
      if(onTryOn){const tryOn=make('button','try-match','Try on in 3D'),message=make('p','try-match-status');tryOn.type='button';message.setAttribute('role','status');tryOn.addEventListener('click',async()=>{tryOn.disabled=true;message.textContent='';try{await onTryOn(item.product.id,item.size);}catch(error){message.textContent=error.message;}finally{tryOn.disabled=false;}});card.append(tryOn,message);}
      grid.append(card);
    }
    results.append(grid);
    if(result.limitations.length){const details=make('details','recommendation-limitations');details.append(make('summary','','About these estimates'));for(const note of result.limitations)details.append(make('p','',note));results.append(details);}
  }
  form.addEventListener('input',clear);
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!catalog||profileDirty)return;
    clear();const version=requestVersion;controller=new AbortController();button.disabled=true;button.textContent=provider==='gemini'?'Finding your matches…':'Comparing measurements…';status.textContent=provider==='gemini'?'Gemini is reviewing your preferences and the sample garments…':'Reviewing the sample garments…';results.setAttribute('aria-busy','true');
    try{
      const preferences=Object.fromEntries(new FormData(form)),request=buildRecommendationRequest(getMeasurements(),preferences);
      currentPayload=buildModelPayload(request,catalog);payloadDetails.querySelector('pre').textContent=JSON.stringify(currentPayload,null,2);payloadDetails.hidden=false;
      let result;
      if(apiAvailable){
        const response=await fetch('/api/recommendations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(30000)])});
        if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('The recommendation service is unavailable. Please try again.');
        result=await response.json();if(!response.ok)throw new Error(typeof result.message==='string'?result.message:'Recommendations could not be generated. Please try again.');
      }else result=createDemoRecommendations(currentPayload);
      if(version!==requestVersion)return;
      render(result);status.textContent=result.provider==='gemini'?'Recommendations from Gemini · Sample catalog':'Sample results · Measurement matching';
    }catch(error){if(version!==requestVersion||error.name==='AbortError')return;status.textContent=error.name==='TimeoutError'?'The recommendation service took too long. Please try again.':error.message||'Recommendations could not load. Please try again.';}
    finally{if(version===requestVersion){button.disabled=profileDirty;button.textContent='Find my matches';results.removeAttribute('aria-busy');}}
  });
  payloadDetails.querySelector('.download-payload').addEventListener('click',()=>{
    if(!currentPayload)return;const url=URL.createObjectURL(new Blob([JSON.stringify(currentPayload,null,2)],{type:'application/json'}));const link=make('a','');link.href=url;link.download='qloset-recommendation-payload.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  (async()=>{
    try{
      catalog=await loadCatalog();
      if(location.protocol!=='file:'){
        try{const response=await fetch('/api/status',{signal:AbortSignal.timeout(4000)});if(response.ok&&response.headers.get('content-type')?.includes('application/json')){const state=await response.json();if(state.provider==='gemini'||state.provider==='demo'){apiAvailable=true;provider=state.provider;}}}catch{/* Static previews keep measurement matching available. */}
      }
      container.querySelector('#recommendation-provider').textContent=provider==='gemini'?'Gemini connected':'Sample matching';
      container.querySelector('#recommendation-data-note').textContent=provider==='gemini'?'Finding matches sends your estimated measurements and shopping request to Gemini.':'Preview matches from 40 fictional garments. Gemini is not connected.';
      button.disabled=profileDirty;
    }catch(error){status.textContent=error.message;container.querySelector('#recommendation-provider').textContent='Catalog unavailable';}
  })();
  return {
    invalidate(){profileDirty=true;clear();status.textContent='Updating your measurements. Complete any unfinished profile fields before finding matches.';},
    update(){profileDirty=false;clear();}
  };
}
