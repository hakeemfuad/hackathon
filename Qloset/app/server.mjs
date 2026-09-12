import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {buildModelPayload, createDemoRecommendations, validateRecommendationRequest} from './dist/recommendations.js';
import {DEFAULT_GEMINI_MODEL, GeminiError, requestGeminiRecommendations, validateGeminiModel} from './server/gemini.mjs';

export const MAX_REQUEST_BYTES = 32 * 1024;
const DIST_DIRECTORY = new URL('./dist/', import.meta.url);
// Explicit file names prevent .env, repository metadata, source server code, and docs being served.
const STATIC_FILES = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/measurements.js', ['measurements.js', 'text/javascript; charset=utf-8']],
  ['/recommendations.js', ['recommendations.js', 'text/javascript; charset=utf-8']],
  ['/recommendation-panel.js', ['recommendation-panel.js', 'text/javascript; charset=utf-8']],
  ['/recommendations.css', ['recommendations.css', 'text/css; charset=utf-8']],
  ['/body-viewer.js', ['body-viewer.js', 'text/javascript; charset=utf-8']],
  ['/undergarments.js', ['undergarments.js', 'text/javascript; charset=utf-8']],
  ['/catalog.js', ['catalog.js', 'text/javascript; charset=utf-8']],
  ['/garment-model.js', ['garment-model.js', 'text/javascript; charset=utf-8']],
  ['/wardrobe.js', ['wardrobe.js', 'text/javascript; charset=utf-8']],
  ['/wardrobe.css', ['wardrobe.css', 'text/css; charset=utf-8']],
  ['/body.json', ['body.json', 'application/json; charset=utf-8']],
  ['/data/products.json', ['data/products.json', 'application/json; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
  ['/vendor/three.module.js', ['vendor/three.module.js', 'text/javascript; charset=utf-8']],
  ['/vendor/LICENSE-three.txt', ['vendor/LICENSE-three.txt', 'text/plain; charset=utf-8']],
  ['/LICENSE-MakeHuman.txt', ['LICENSE-MakeHuman.txt', 'text/plain; charset=utf-8']]
]);

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    Object.assign(this, {status, code});
  }
}

function sendJson(response, status, body, extraHeaders = {}) {
  response.writeHead(status, {'content-type': 'application/json; charset=utf-8', ...extraHeaders});
  response.end(JSON.stringify(body));
}

function readJson(request) {
  if (!/^application\/json(?:\s*;.*)?$/i.test(request.headers['content-type'] || '')) {
    request.resume();
    throw new HttpError(415, 'json_required', 'Send the request as application/json.');
  }
  if (request.headers['content-encoding'] && request.headers['content-encoding'] !== 'identity') {
    request.resume();
    throw new HttpError(415, 'encoding_unsupported', 'Compressed request bodies are not supported.');
  }
  if (Number(request.headers['content-length']) > MAX_REQUEST_BYTES) {
    request.resume();
    throw new HttpError(413, 'request_too_large', 'The request body is too large.');
  }
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let bytes = 0;
    const cleanup = () => {
      request.off('data', onData);
      request.off('end', onEnd);
      request.off('error', onError);
      request.off('aborted', onAborted);
    };
    const fail = error => {
      cleanup();
      request.resume();
      reject(error);
    };
    const onData = chunk => {
      bytes += chunk.length;
      if (bytes > MAX_REQUEST_BYTES) {
        fail(new HttpError(413, 'request_too_large', 'The request body is too large.'));
        return;
      }
      chunks.push(Buffer.from(chunk));
    };
    const onEnd = () => {
      cleanup();
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'invalid_json', 'The request body must be valid JSON.'));
      }
    };
    const onError = () => fail(new HttpError(400, 'request_interrupted', 'The request could not be read.'));
    const onAborted = () => onError();
    request.on('data', onData);
    request.on('end', onEnd);
    request.on('error', onError);
    request.on('aborted', onAborted);
  });
}

// This handler can be exercised without opening a port. The factory below uses the same handler.
export async function createRecommendationHandler({
  apiKey = process.env.GEMINI_API_KEY || '',
  model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
  catalog,
  fetchImpl = globalThis.fetch,
  timeoutMs,
  distDirectory = DIST_DIRECTORY
} = {}) {
  validateGeminiModel(model);
  const configured = typeof apiKey === 'string' && Boolean(apiKey.trim());
  const trustedCatalog = catalog ?? JSON.parse(await readFile(new URL('data/products.json', distDirectory), 'utf8'));
  return async function handleRequest(request, response) {
    response.setHeader('cache-control', 'no-store');
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('referrer-policy', 'no-referrer');
    try {
      // The demo binds to loopback; restricting Host also protects its key-backed endpoint from DNS rebinding.
      const host = request.headers.host || '';
      if (!/^(?:127\.0\.0\.1|localhost)(?::\d{1,5})?$/i.test(host)) {
        throw new HttpError(403, 'host_forbidden', 'Use the local Qloset server address.');
      }
      if (typeof request.url !== 'string' || !request.url.startsWith('/') || request.url.startsWith('//')) {
        throw new HttpError(400, 'invalid_path', 'Invalid request path.');
      }
      const pathname = new URL(request.url, `http://${host}`).pathname;
      if (pathname === '/api/status') {
        if (request.method !== 'GET') {
          return sendJson(response, 405, {error: 'method_not_allowed', message: 'Use GET for this endpoint.'}, {allow: 'GET'});
        }
        return sendJson(response, 200, {provider: configured ? 'gemini' : 'demo', configured, model: configured ? model : null});
      }
      if (pathname === '/api/recommendations') {
        if (request.method !== 'POST') {
          return sendJson(response, 405, {error: 'method_not_allowed', message: 'Use POST for this endpoint.'}, {allow: 'POST'});
        }
        const origin = request.headers.origin;
        if ((origin && origin !== `http://${host}`) || request.headers['sec-fetch-site'] === 'cross-site') {
          throw new HttpError(403, 'origin_forbidden', 'Send recommendations from the same Qloset server origin.');
        }
        const input = await readJson(request);
        let validated;
        try {
          validated = validateRecommendationRequest(input);
        } catch {
          throw new HttpError(400, 'invalid_request', 'Measurements or shopping preferences are invalid.');
        }
        const payload = buildModelPayload(validated, trustedCatalog);
        const result = configured
          ? await requestGeminiRecommendations(payload, {apiKey, model, fetchImpl, timeoutMs})
          : createDemoRecommendations(payload);
        return sendJson(response, 200, result);
      }
      const asset = STATIC_FILES.get(pathname);
      if (!asset) throw new HttpError(404, 'not_found', 'This resource was not found.');
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return sendJson(response, 405, {error: 'method_not_allowed', message: 'Use GET or HEAD for static files.'}, {allow: 'GET, HEAD'});
      }
      let content;
      try {
        content = await readFile(new URL(asset[0], distDirectory));
      } catch (error) {
        if (error.code === 'ENOENT') throw new HttpError(404, 'not_found', 'This resource was not found.');
        throw error;
      }
      response.writeHead(200, {'content-type': asset[1], 'content-length': content.length});
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (response.writableEnded || response.destroyed) return;
      if (error instanceof HttpError || error instanceof GeminiError) {
        return sendJson(response, error.status, {error: error.code, message: error.message});
      }
      // Deliberately omit error objects, bodies, and keys from logs and responses.
      return sendJson(response, 500, {error: 'internal_error', message: 'The server could not complete this request.'});
    }
  };
}

export async function createRecommendationServer(options = {}) {
  const handler = await createRecommendationHandler(options);
  const server = createServer(handler);
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  return server;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const port = Number(process.env.PORT || 4173);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
    const server = await createRecommendationServer();
    server.on('error', error => {
      const explanation = error.code === 'EADDRINUSE' ? 'Another process is already using PORT.'
        : error.code === 'EPERM' || error.code === 'EACCES' ? 'Local network access was denied by the runtime permissions.'
          : 'Check PORT and whether another server is running.';
      console.error(`Qloset could not open its local port. ${explanation}`);
      process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => {
      console.log(`Qloset is running at http://127.0.0.1:${port}`);
      console.log(process.env.GEMINI_API_KEY?.trim() ? 'Recommendations: Gemini (server key configured).' : 'Recommendations: local demo (no Gemini key configured).');
    });
  } catch (error) {
    console.error(error.message === 'PORT must be an integer from 1 to 65535.' || error.message.startsWith('GEMINI_MODEL must')
      ? error.message : 'Qloset could not start. Check that dist/data/products.json and the recommendation module exist.');
    process.exitCode = 1;
  }
}
