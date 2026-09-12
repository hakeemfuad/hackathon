# Measurement-to-product recommendations

The form's existing centimeter estimates are converted once to inches by `buildRecommendationRequest` in `dist/recommendations.js`. The browser sends that small request to the local Node server. The server validates it, reads the trusted 40-product catalog from `dist/data/products.json`, applies the deterministic garment fit policy, and gives Gemini the complete catalog plus eligible product/size pairs. Gemini ranks suitable options and explains how they relate to the user's request. Returned IDs and sizes are checked against those eligible pairs before the server attaches product details and numeric comparisons.

The catalog contains 10 pants, 10 short sleeve shirts, 10 hoodies, and 10 long sleeve shirts. It is fictional seed data. Every numeric garment measurement uses inches and represents finished-garment dimensions; circumferences are full circumferences, not flat half-widths. The request's body measurements remain illustrative estimates from the existing form, so recommendations are conditional suggestions rather than a fit guarantee.

## Run locally

Requires Node 22.9 or newer. There are no npm dependencies to install.

```sh
cd /Users/brittanyderasmo/Desktop/Qloset/app
cp .env.example .env
# Edit .env to set GEMINI_API_KEY if you want live Gemini recommendations.
npm start
```

Open `http://127.0.0.1:4173`. With an empty key, the server returns clearly labelled deterministic demo recommendations. With a key, recommendations use Gemini. Restart after editing `.env`. `GEMINI_MODEL` defaults to `gemini-3.6-flash`; set another accessible text model that supports structured JSON output if needed. `PORT` defaults to `4173`.

The key lives only in the server environment. Never add it to `dist/`, `Qloset.html`, the browser, or a committed file. `.env` is ignored by Git; `.env.example` has no credentials. The server sends the estimated measurements, shopping preferences, and catalog to Google's Gemini API only when a configured recommendation request is submitted. It does not persist request bodies or log keys, body measurements, or upstream response bodies.

Static hosting and the standalone `Qloset.html` cannot execute this Node endpoint; they retain the local demo behavior. Gemini requires running the Node server. This listener is intentionally local at `127.0.0.1`; a public deployment needs its own server deployment, authentication, and usage limits.

## API contract

`GET /api/status` returns configuration status without exposing credentials:

```json
{"provider":"demo","configured":false,"model":null}
```

When configured, `provider` is `gemini`, `configured` is `true`, and `model` is the configured model ID. This reports configuration, not an upstream health check.

`POST /api/recommendations` accepts this exact versioned shape. All nine body fields are numeric inches. `category` must be `pants`, `short_sleeve_shirt`, `hoodie`, or `long_sleeve_shirt`; `fit` must be `slim`, `regular`, or `relaxed`. The optional shopping description is represented by `query` (use an empty string if omitted in the UI), limited to 500 characters. `limit` is 3. Extra properties, nonfinite/out-of-range measurements, and other units or measurement sources are rejected.

```sh
curl http://127.0.0.1:4173/api/recommendations \
  -H 'Content-Type: application/json' \
  --data-binary '{
    "schema_version": "1.0",
    "units": "in",
    "measurement_source": "illustrative_estimate",
    "body": {
      "height": 70,
      "chest": 40,
      "waist": 33,
      "hip": 40,
      "shoulder_width": 18,
      "inseam": 32,
      "sleeve_length": 25,
      "thigh": 23,
      "upper_arm": 13
    },
    "preferences": {
      "category": "short_sleeve_shirt",
      "fit": "regular",
      "query": "A breathable cotton shirt for everyday wear."
    },
    "limit": 3
  }'
```

The browser never supplies the catalog or candidate list. The server builds those from trusted local files. The model payload includes the validated request, the entire catalog, `eligible_candidates`, `fit_policy`, and `limitations`; open `buildModelPayload` to inspect the complete schema. An eligible size means it passes the prototype's stated ease and dimensional tolerances. It is not evidence of a scientifically validated fit predictor. A free-text request cannot make an ineligible size eligible.

The checked-in `examples/recommendation-request.json`, `examples/gemini-payload.json`, and `examples/demo-response.json` show an actual generated request, complete model input, and hydrated response. Regenerate them with `node scripts/export-recommendation-example.mjs`. To submit the generated request:

```sh
curl http://127.0.0.1:4173/api/recommendations \
  -H 'Content-Type: application/json' \
  --data-binary @examples/recommendation-request.json
```

The model returns only:

```json
{
  "summary": "A short, conditional explanation of the matches.",
  "recommendations": [
    {
      "product_id": "an eligible catalog product ID",
      "size": "an eligible size label",
      "reason": "Why the known garment measurements may suit the requested fit.",
      "warnings": ["Any relevant caveats."]
    }
  ]
}
```

The API response adds `provider`, `limitations`, and trusted `product`, `comparisons`, and `fit_score` fields to the recommendations. The result may contain fewer than three recommendations or no matches. Gemini may return no matches when the shopping preferences are incompatible with the eligible catalog items. The deterministic demo applies the core fit ranking and cannot provide Gemini's full language interpretation.

Browser POST requests must have the same origin as the local server; command-line requests without an Origin header are accepted. JSON bodies are limited to 32 KiB. The server returns JSON errors as `{"error":"stable_code","message":"safe explanation"}` with HTTP 400 for invalid input, 403 for a disallowed origin/Host, 413 for an oversized body, or 415 for unsupported content types. Gemini has a 25-second timeout (504); upstream failures, incomplete output, or unverifiable recommendations return 502. A configured Gemini failure never silently falls back to demo recommendations.

## Verification

```sh
npm test
npm run build
```

Core checks cover inch conversion, catalog coverage, fit eligibility, and response validation. API checks exercise the actual request handler using Node request streams and injected Gemini fetch responses: no key, successful structured output, input and origin validation, size limits, invented ID/size rejection, upstream errors, and timeouts. They also check that secrets and server files cannot be served. These automated tests do not use a real Gemini key or incur a paid call.

A live request to `gemini-3.6-flash` was verified on September 12, 2026 with the synthetic example profile and all 40 products. It returned three eligible product/size pairs with measurement-based explanations, and passed the same response validator. The default was updated from `gemini-2.5-flash` after Google's generation endpoint reported that model unavailable to new users. A configured key still needs quota and access to the selected model.

The REST implementation follows Google's [generateContent API reference](https://ai.google.dev/api/generate-content) and [Gemini model catalog](https://ai.google.dev/gemini-api/docs/models). It sends the key in the `x-goog-api-key` header, asks for `application/json` with `responseJsonSchema`, and independently validates the resulting data.
