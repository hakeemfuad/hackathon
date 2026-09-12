# Qloset

A browser tech demo that creates an interactive 3D adult body from the Clad questionnaire. The interface uses feet/inches and pounds. Measurement results display inches; the geometry and research contract use centimeters and kilograms internally.

Open `Qloset.html` as a standalone, offline presentation backup. It bundles the same questionnaire, renderer, meshes, and styling as `dist/`. Regenerate it after source changes with `node scripts/build-preview.mjs`. `dist/index.html` is the static Site entrypoint when served over HTTP.

## Run the demo

**Fastest presentation option:** download this repository, extract it, and open **Qloset.html** in a modern desktop browser with WebGL enabled. It includes the body model, questionnaire, renderer, styling, and sample clothing matcher. It works offline without an API key or installation.

**Local app with optional Gemini:** use Node.js 22.9 or newer, open a terminal in this repository, and run:

```sh
npm start
```

Open **http://127.0.0.1:4173**. No npm dependencies need to be installed. Without an API key, results are explicitly labeled as sample measurement matching. Regenerate the offline HTML after source changes with `npm run build`. `dist/index.html` is the static entrypoint when served over HTTP.

## Presentation walkthrough

1. Choose a sample profile and rotate the body with the pointer or front/side/back controls.
2. Change gender, body shape, or build to show the live silhouette update.
3. Edit height or weight to show the body and estimated dimensions respond in imperial units.
4. Show that the opaque sports top and shorts stay fitted as proportions change.
5. Choose a clothing category and fit, then select **Find my matches**. Inspect a size and the garment-versus-body measurements.
6. Open **View recommendation payload** to inspect or download the input. Changing the body clears stale recommendations.

For a predictable sample recommendation, the Hourglass profile with pants and regular fit matches the Curved Waist Utility Pant. Some profiles correctly produce no match in this limited fictional catalog.

## Implemented

- Height, weight, gender, heritage, body shape, belly, build, legs, arms, and cup-size fields from the current Clad form.
- Six sample profiles, input validation, generated model updates, pointer/keyboard rotation and zoom, front/side/back views, automatic rotation, and measurement contours.
- Eight skin tone swatches beside the preview update the mannequin immediately. The selection stays in place when changing profiles or resetting the view; it is independent of heritage and measurements.
- Distinct adult reference meshes; connected torso contours fitted to the displayed target circumferences. Height remains fixed through limb-proportion changes.
- WebMCP actions `generate_body` and `read_body_profile`, feature-detected in supported browsers.

## Limits and research integration

This is an approximate body preview, not a calibrated predictor or a body scan. `dist/measurements.js` contains explicitly provisional visual defaults. The current questionnaire cannot establish a person's precise circumferences. No benchmark accuracy from Clad or another model is claimed for Qloset.

Heritage remains neutral. Cup size remains neutral without band and sizing-system information. Apple and belly share one central-prominence adjustment. Proposed demographic offsets and age-dependent formulas were not silently imported. Direct user measurement overrides and validated prediction can replace the estimator later.

The recommendation integration sends estimated measurements in inches, shopping preferences, and the fictional product catalog to Gemini through a local server when `GEMINI_API_KEY` is configured. The browser never receives that key. Without a key, the app explicitly labels results as sample measurement matching. There is no account storage or persistent body-profile database. The standalone HTML keeps matching local.

## Clothing recommendations

Run `npm start` from this directory and open `http://127.0.0.1:4173`. No package installation is needed. To enable Gemini, copy `.env.example` to `.env`, add your key, and restart the server. See [the API guide](docs/recommendation-api.md) for setup, the request contract, and a curl example.

- `dist/data/products.json` contains 40 fictional products: 10 pants, 10 short-sleeve shirts, 10 hoodies, and 10 long-sleeve shirts. Each has seven sizes (280 variants), measured in finished-garment inches. Circumferences are full circumferences, not flat widths.
- `dist/recommendations.js` converts generated centimeter measurements to an explicit inch payload, checks garment room against the selected fit, and validates Gemini product/size selections against eligible catalog entries. Fit scores are ordering heuristics, not probabilities.
- Choose a category and preferred fit in the studio, optionally describe what you want, then select **Find my matches**. Results include a size, explanation, garment-versus-body dimensions, and fit limitations. Profile changes clear previous recommendations so old results do not describe a new body.
- **View recommendation payload** lets you inspect and download the full model input, including the 40 products and computed comparisons. Heritage, gender, weight, and raw questionnaire answers are excluded from that payload.
- `server/gemini.mjs` makes the Gemini API call with structured JSON output. Configured API failures are shown as errors; they are not disguised as model recommendations.

These are sample recommendations from illustrative body estimates. Garment sizing and fit thresholds are synthetic heuristics, not validated personal fit predictions. The current static Site remains a sample preview: live Gemini requires the Node server or a separately provisioned server endpoint.

Run `npm test` for recommendation and API checks, `npm run test:geometry` for body geometry checks, and `npm run build` to regenerate the standalone HTML. Gemini success and failure paths were tested with simulated responses. A real Gemini call still needs a configured key and remains unverified.

## Validation

`node scripts/check-model.mjs` checks finite geometry, exact user height, invalid-input rejection, neutral heritage, and directional size changes across the six presets. It records geometric torso dimensions alongside target estimates. These are software and geometry checks, not anthropometric validation.

`scripts/render-model-check.py` generates an offline mesh-inspection figure. It is not a website screenshot. The refined model was also checked interactively in the local browser preview; WebMCP execution is not covered by the numerical model checks.

## Source assets

- [MakeHuman hm08](https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/3dobjs/base.obj), adult reference morphs, and [default skin weights](https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/rigs/default_weights.mhw): CC0, included license. Fixed reference blends are independent of heritage selections.
- [Three.js r160](https://github.com/mrdoob/three.js/tree/r160): MIT, vendored with license.

The source Site is registered in `.openai/hosting.json`. Reuse that exact Site ID for private publication through the native Sites hosting flow.
## Body realism refinement

The renderer now uses the reference mesh's arm skin weights, local shoulder/elbow/wrist transforms, and a continuous pelvis-to-leg blend. Arm girth scales perpendicular to the bone and tapers toward the wrist, preserving hand and forearm shape. One Loop subdivision increases the rendered surface to 53,514 vertices / 107,024 triangles; the control cage and original CC0 mesh remain intact. Smoothed bust, waist, and hip contours are fitted back to the displayed target dimensions, with the actual remapped landmark heights used for short/long legs. The connected torso contour is selected without clipping larger bodies by a fixed width.

The studio uses a matte, nonmetallic material, tone mapping, balanced key/fill/rim lighting, and a softened ground shadow. Body self-shadowing is disabled to avoid hard hand-shadow artifacts from the directional studio lights. Camera framing keeps feet above the view controls.

Validation: `node scripts/check-model.mjs` checks six presets, finite geometry/normals, exact overall height, smoothed contour agreement within 1 cm, short/long limb combinations, invalid inputs, weight responsiveness, and neutral heritage. Browser inspection covers the default front view, stocky side view, and athletic back view. This improves the illustrative mannequin's appearance; the questionnaire still does not reconstruct an individual's exact anatomy.

The base undergarments use opaque black fabric: female profiles wear a bralette and briefs, and male profiles wear fitted shorts with a bare chest until a shirt is tried on. The female set follows the supplied reference with thin shoulder straps, a curved neckline, an under-bust band, and curved brief leg openings. Shared sewing-line vertices keep the fabric joined to the skin as the body changes. Removing a selected shirt restores that base layer. The garments follow the subdivided mesh when profiles change while leaving the complete measurement surface intact. Choice fields update immediately; numeric fields debounce for 250 ms without resetting the input caret.

`node scripts/check-undergarments.mjs` (after the model check) verifies opaque coverage across all six presets, complete surface partitioning, connected straps and garments, closed seams with no gaps, finite geometry and normals, and switching between female and male defaults. Browser checks also cover the female front, side, and back views and restoring the base set after removing a tried-on shirt.
