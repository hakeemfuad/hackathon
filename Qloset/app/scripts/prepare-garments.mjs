import {readFile,writeFile} from 'node:fs/promises';

// Supplemental construction dimensions are synthetic, kept separate from the
// original finished-garment size chart used by the recommendation service.
const path=new URL('../dist/data/products.json',import.meta.url);
const catalog=JSON.parse(await readFile(path,'utf8'));
const colors={
  pants:['#ac926f','#535d66','#777665','#d4c9b4','#3b5773','#363e4b','#65716b','#3e4b61','#777452','#474650'],
  short_sleeve_shirt:['#b76648','#4b596d','#d3c5aa','#70877e','#314c65','#97859a','#b5a994','#567b83','#9f665d','#657361'],
  hoodie:['#73848c','#8b7569','#526d65','#b58170','#565968','#897b98','#b2a087','#547682','#a18b70','#49586b'],
  long_sleeve_shirt:['#657d8e','#9e746d','#a2b9c6','#c1b89f','#737e96','#677b69','#a18c73','#8a5550','#776d83','#6e785c'],
};
const round=n=>Math.round(n*100)/100;
catalog.render_version='procedural-garments-v1';
catalog.measurement_notes.rendering='3D construction dimensions, colors, and details are illustrative defaults. Original finished-garment dimensions remain in each size.measurements. Supplemental dimensions in size.render_dimensions are synthetic inches; they are not manufacturer specifications. The preview is a posed geometric approximation, not a fabric or fit simulation.';
for(const p of catalog.products){
  const index=Number(p.id.split('-').at(-1))-1,tags=p.tags;
  p.render={template:p.category,color:colors[p.category][index],construction_source:'synthetic_preview',pattern:tags.includes('flannel')?'plaid':'solid',neckline:tags.includes('mock_neck')?'mock':tags.some(t=>['button_front','polo','camp_collar'].includes(t))?'collar':'crew',closure:tags.includes('full_zip')?'zip':tags.includes('button_front')?'buttons':tags.some(t=>['henley','polo'].includes(t))?'placket':'none'};
  for(const entry of p.sizes){
    const m=entry.measurements,i=p.sizes.indexOf(entry);
    entry.render_dimensions=p.category==='pants'?{
      rise:round((tags.includes('high_rise')?12.5:10.75)+i*.25),
      knee:round(m.thigh*(tags.includes('tapered_leg')?.69:.78)),
      leg_opening:round(m.thigh*(tags.includes('cuffed')?.43:tags.includes('tapered_leg')?.56:.70)),
    }:{
      neck_width:round(6.1+i*.13),neck_depth:round(p.render.neckline==='collar'?2.3:2.8),
      cuff:round(p.category==='short_sleeve_shirt'?m.upper_arm*.90:8.1+i*.4),
      ...(p.category==='hoodie'?{hood_height:round(12+i*.2),hood_width:round(9.5+i*.2)}:{}),
    };
  }
}
await writeFile(path,JSON.stringify(catalog,null,2)+'\n');
console.log(`Prepared ${catalog.products.length} garment designs / ${catalog.products.reduce((n,p)=>n+p.sizes.length,0)} sized variants.`);
