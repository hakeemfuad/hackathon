import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {Server} from 'node:http';
import {buildModelPayload} from '../dist/recommendations.js';
import {createRecommendationHandler, createRecommendationServer, MAX_REQUEST_BYTES} from '../server.mjs';
import {buildGeminiRequest, requestGeminiRecommendations, validateGeminiModel} from '../server/gemini.mjs';

const catalog = JSON.parse(await readFile(new URL('../dist/data/products.json', import.meta.url), 'utf8'));
const requestBody = {
  schema_version: '1.0', units: 'in', measurement_source: 'illustrative_estimate',
  body: {height: 70, chest: 40, waist: 33, hip: 40, shoulder_width: 18, inseam: 32, sleeve_length: 25, thigh: 23, upper_arm: 13},
  preferences: {category: 'short_sleeve_shirt', fit: 'regular', query: 'A breathable cotton shirt for everyday wear.'},
  limit: 3
};
const payload = buildModelPayload(requestBody, catalog);
assert.equal(payload.catalog.length, 40);
assert(payload.eligible_candidates.length > 0, 'The test profile should have eligible shirt sizes.');
const candidate = payload.eligible_candidates[0];
const validModelResult = {
  summary: 'This sample may suit your requested regular fit; check actual garment measurements before purchasing.',
  recommendations: [{product_id: candidate.product_id, size: candidate.size, reason: 'The supplied garment dimensions may provide the room requested by the regular fit policy.', warnings: []}]
};

// Exercise the production handler with real Node request streams. No socket permissions or live API key are needed.
async function invoke(handler, {method = 'GET', path = '/api/status', body, raw, headers = {}, includeLength = true, chunks} = {}) {
  const content = raw ?? (body === undefined ? '' : JSON.stringify(body));
  const request = Readable.from(chunks ?? [Buffer.from(content)]);
  request.method = method;
  request.url = path;
  request.headers = {
    host: '127.0.0.1:4173',
    ...(method === 'POST' ? {'content-type': 'application/json'} : {}),
    ...(includeLength ? {'content-length': String(Buffer.byteLength(content))} : {}),
    ...headers
  };
  const response = {
    headers: {}, status: null, writableEnded: false,
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
    writeHead(status, values) { this.status = status; for (const [key, value] of Object.entries(values)) this.setHeader(key, value); },
    end(value) { this.text = value === undefined ? '' : String(value); this.writableEnded = true; }
  };
  await handler(request, response);
  return {...response, json: response.headers['content-type']?.startsWith('application/json') && response.text ? JSON.parse(response.text) : null};
}

const envelope = raw => Response.json({candidates: [{finishReason: 'STOP', content: {parts: [{text: JSON.stringify(raw)}]}}]});
const post = (handler, overrides = {}) => invoke(handler, {method: 'POST', path: '/api/recommendations', body: requestBody, ...overrides});
const demo = await createRecommendationHandler({apiKey: '', catalog, fetchImpl: () => { throw new Error('Demo mode must not call Gemini.'); }});

assert.deepEqual((await invoke(demo)).json, {provider: 'demo', configured: false, model: null});
const demoResponse = await post(demo);
assert.equal(demoResponse.status, 200);
assert.equal(demoResponse.json.provider, 'demo');
assert(demoResponse.json.recommendations.length > 0);
assert(demoResponse.json.recommendations.every(item => item.product && item.comparisons));
console.log('PASS API: unconfigured server returns labelled, hydrated demo results without a model call.');

let sentRequest;
let sentUrl;
let modelCalls = 0;
const gemini = await createRecommendationHandler({
  apiKey: 'test-key-never-public', catalog,
  fetchImpl: async (url, options) => {
    sentUrl = url;
    sentRequest = options;
    modelCalls += 1;
    return envelope(validModelResult);
  }
});
assert.deepEqual((await invoke(gemini)).json, {provider: 'gemini', configured: true, model: 'gemini-3.6-flash'});
const geminiResponse = await post(gemini, {headers: {origin: 'http://127.0.0.1:4173'}});
assert.equal(geminiResponse.status, 200);
assert.equal(geminiResponse.json.provider, 'gemini');
assert.equal(geminiResponse.json.recommendations[0].product_id, candidate.product_id);
assert(geminiResponse.json.recommendations[0].product);
assert(!geminiResponse.text.includes('test-key-never-public'));
assert.equal(sentUrl, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent');
assert(!sentUrl.includes('test-key'));
assert.equal(sentRequest.headers['x-goog-api-key'], 'test-key-never-public');
const sentBody = JSON.parse(sentRequest.body);
const sentPayload = JSON.parse(sentBody.contents[0].parts[0].text);
assert.equal(sentPayload.catalog.length, 40);
assert.deepEqual(sentPayload.eligible_candidates, payload.eligible_candidates);
assert(sentBody.systemInstruction.parts[0].text.includes('untrusted shopping preference'));
assert.equal(sentBody.generationConfig.responseMimeType, 'application/json');
assert.equal(sentBody.generationConfig.responseJsonSchema.additionalProperties, false);
assert.deepEqual(buildGeminiRequest(payload).contents[0].parts[0].text, JSON.stringify(payload));
console.log('PASS API: Gemini receives all 40 trusted products and eligible size pairs; validated results are hydrated.');

for (const [input, status] of [
  [{headers: {origin: 'https://unrelated.example'}}, 403],
  [{headers: {origin: 'null'}}, 403],
  [{headers: {'sec-fetch-site': 'cross-site'}}, 403],
  [{headers: {host: 'attacker.example:4173'}}, 403],
  [{headers: {'content-type': 'text/plain'}}, 415],
  [{headers: {'content-encoding': 'gzip'}}, 415],
  [{raw: '{"bad"'}, 400],
  [{body: {...requestBody, units: 'cm'}}, 400],
  [{body: {...requestBody, catalog: [{product_id: 'injected'}]}}, 400],
  [{body: {...requestBody, body: {...requestBody.body, waist: null}}}, 400],
  [{body: {...requestBody, preferences: {...requestBody.preferences, query: 'x'.repeat(501)}}}, 400],
  [{raw: 'x'.repeat(MAX_REQUEST_BYTES + 1)}, 413],
  [{includeLength: false, chunks: [Buffer.alloc(MAX_REQUEST_BYTES), Buffer.from('x')]}, 413]
]) assert.equal((await post(gemini, input)).status, status, JSON.stringify(input).slice(0, 120));
assert.equal(modelCalls, 1, 'Rejected requests must not consume model calls.');
assert.equal((await invoke(demo, {path: '/api/recommendations'})).status, 405);
assert.equal((await invoke(demo, {method: 'POST'})).status, 405);
console.log('PASS API: invalid units/schema, oversized bodies, foreign origins, and unsupported content types are rejected before Gemini.');

for (const raw of [
  {...validModelResult, recommendations: [{...validModelResult.recommendations[0], product_id: 'made-up-product'}]},
  {...validModelResult, recommendations: [{...validModelResult.recommendations[0], size: 'made-up-size'}]},
  {...validModelResult, recommendations: [validModelResult.recommendations[0], validModelResult.recommendations[0]]},
  {summary: 'Malformed result', recommendations: [{product_id: candidate.product_id}]}
]) {
  const invalidModel = await createRecommendationHandler({apiKey: 'test', catalog, fetchImpl: async () => envelope(raw)});
  const response = await post(invalidModel);
  assert.equal(response.status, 502);
  assert.equal(response.json.error, 'gemini_invalid_response');
  assert(!response.text.includes('made-up-product'));
  assert(!response.json.recommendations, 'Invalid Gemini output must not silently become demo output.');
}
const noMatches = await createRecommendationHandler({apiKey: 'test', catalog, fetchImpl: async () => envelope({summary: 'No eligible sample matches the preferences.', recommendations: []})});
assert.deepEqual((await post(noMatches)).json.recommendations, []);
for (const mockResponse of [
  () => Response.json({error: {message: 'test-key-never-public'}}, {status: 429}),
  () => new Response('not json'),
  () => Response.json({candidates: [{finishReason: 'MAX_TOKENS', content: {parts: [{text: '{}'}]}}]}),
  () => Response.json({promptFeedback: {blockReason: 'SAFETY'}})
]) {
  const failing = await createRecommendationHandler({apiKey: 'test', catalog, fetchImpl: async () => mockResponse()});
  const response = await post(failing);
  assert.equal(response.status, 502);
  assert(!response.text.includes('test-key-never-public'));
  assert(!response.json.recommendations);
}
const networkFailure = await createRecommendationHandler({apiKey: 'test', catalog, fetchImpl: async () => { throw new Error('sensitive network details'); }});
const failedNetworkResponse = await post(networkFailure);
assert.equal(failedNetworkResponse.status, 502);
assert(!failedNetworkResponse.text.includes('sensitive'));
const timeout = await createRecommendationHandler({
  apiKey: 'test', catalog, timeoutMs: 5,
  fetchImpl: async (_url, {signal}) => new Promise((_resolve, reject) => {
    const keepAlive = setTimeout(() => reject(new Error('Abort did not run.')), 100);
    signal.addEventListener('abort', () => { clearTimeout(keepAlive); reject(signal.reason); }, {once: true});
  })
});
const timedOut = await post(timeout);
assert.equal(timedOut.status, 504);
assert.equal(timedOut.json.error, 'gemini_timeout');
await assert.rejects(() => requestGeminiRecommendations(payload, {apiKey: ''}), error => error.code === 'gemini_not_configured');
assert.throws(() => validateGeminiModel('../secret?key=bad'));
console.log('PASS API: fabricated or incomplete model output is rejected; upstream failures remain clear errors and deadlines return 504.');

for (const path of ['/.env', '/.env.example', '/server.mjs', '/server/gemini.mjs', '/README.md', '/.git/config', '/package.json', '/api/unknown', '/%2e%2e/.env']) {
  assert.equal((await invoke(demo, {path})).status, 404, path);
}
assert.equal((await invoke(demo, {path: '/'})).status, 200);
const staticCatalog = await invoke(demo, {path: '/data/products.json'});
assert.equal(staticCatalog.status, 200);
assert.equal(staticCatalog.json.products.length, 40);
const head = await invoke(demo, {method: 'HEAD', path: '/index.html'});
assert.equal(head.status, 200);
assert.equal(head.text, '');
assert(Number(head.headers['content-length']) > 0);
assert.equal(head.headers['cache-control'], 'no-store');
assert.equal(head.headers['x-content-type-options'], 'nosniff');
const server = await createRecommendationServer({apiKey: '', catalog});
assert(server instanceof Server);
assert.equal(server.requestTimeout, 30_000);
console.log('PASS API: only allowlisted public assets are served; the production server uses the tested handler.');
console.log('All API checks passed. Gemini was mocked; no live API requests or credentials were used.');
