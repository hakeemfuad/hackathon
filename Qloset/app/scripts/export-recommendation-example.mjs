import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {DEFAULT_PROFILE,estimateMeasurements} from '../dist/measurements.js';
import {buildRecommendationRequest,buildModelPayload,createDemoRecommendations} from '../dist/recommendations.js';

// Reproducible synthetic example: never reads a person's saved profile or a key.
const catalog=JSON.parse(await readFile(new URL('../dist/data/products.json',import.meta.url),'utf8'));
const request=buildRecommendationRequest(estimateMeasurements(DEFAULT_PROFILE),{
  category:'short_sleeve_shirt',fit:'relaxed',query:'A lightweight cotton shirt for everyday wear.'
});
const payload=buildModelPayload(request,catalog);
const directory=new URL('../examples/',import.meta.url);
await mkdir(directory,{recursive:true});
for(const [name,data] of Object.entries({
  'recommendation-request.json':request,
  'gemini-payload.json':payload,
  'demo-response.json':createDemoRecommendations(payload)
}))await writeFile(new URL(name,directory),`${JSON.stringify(data,null,2)}\n`);
console.log('Wrote synthetic example request, full Gemini payload, and labeled demo response to examples/.');
