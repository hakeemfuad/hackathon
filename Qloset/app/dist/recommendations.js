// All values sent to the recommender are inches. These rules are transparent
// demo heuristics, not a validated fit model or a probability of fitting.
export const CATEGORY_LABELS = Object.freeze({
  pants: 'Pants',
  short_sleeve_shirt: 'Short sleeve shirts',
  hoodie: 'Hoodies',
  long_sleeve_shirt: 'Long sleeve shirts',
});

const FITS = ['slim', 'regular', 'relaxed'];
const BODY_FIELDS = {
  height: ['height_cm', 36, 100],
  chest: ['bust_cm', 18, 100],
  waist: ['waist_cm', 15, 100],
  hip: ['hip_cm', 18, 100],
  shoulder_width: ['shoulder_width_cm', 8, 32],
  inseam: ['inseam_cm', 12, 50],
  sleeve_length: ['sleeve_length_cm', 10, 40],
  thigh: ['thigh_cm', 8, 50],
  upper_arm: ['upper_arm_cm', 4, 32],
};
const TOP_FIELDS = ['chest', 'hem', 'shoulder_width', 'sleeve_length', 'length', 'upper_arm'];
const PANTS_FIELDS = ['waist', 'hip', 'thigh', 'inseam'];
const round = value => Math.round((value + Number.EPSILON) * 100) / 100;

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
}

function exactKeys(value, keys, label) {
  record(value, label);
  if (Object.keys(value).some(key => !keys.includes(key))) throw new Error(`${label} contains an unsupported field.`);
  if (keys.some(key => !Object.hasOwn(value, key))) throw new Error(`${label} is missing a required field.`);
}

function boundedText(value, label, maximum, allowEmpty = false) {
  if (typeof value !== 'string' || value.length > maximum || (!allowEmpty && !value.trim())) {
    throw new Error(`${label} must be ${allowEmpty ? 'a string' : 'nonempty text'} of at most ${maximum} characters.`);
  }
  // Content stays data, including text that resembles instructions or markup.
  return value.trim();
}

function positiveNumber(value, label, minimum, maximum) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be a number between ${minimum} and ${maximum} inches.`);
  }
  return round(value);
}

export function validateRecommendationRequest(input) {
  exactKeys(input, ['schema_version', 'units', 'measurement_source', 'body', 'preferences', 'limit'], 'Request');
  if (input.schema_version !== '1.0') throw new Error('Unsupported recommendation schema version.');
  if (input.units !== 'in') throw new Error('Recommendation measurements must use inches (in).');
  if (input.measurement_source !== 'illustrative_estimate') throw new Error('Measurements must identify their illustrative estimate source.');
  exactKeys(input.body, Object.keys(BODY_FIELDS), 'Body measurements');
  exactKeys(input.preferences, ['category', 'fit', 'query'], 'Preferences');
  if (typeof input.preferences.category !== 'string' || !Object.hasOwn(CATEGORY_LABELS, input.preferences.category)) throw new Error('Choose a supported clothing category.');
  if (!FITS.includes(input.preferences.fit)) throw new Error('Choose slim, regular, or relaxed fit.');
  if (input.limit !== 3) throw new Error('The recommendation limit must be 3.');
  const body = Object.fromEntries(Object.entries(BODY_FIELDS).map(([key, [, min, max]]) => [
    key, positiveNumber(input.body[key], `Body ${key.replaceAll('_', ' ')}`, min, max),
  ]));
  return {
    schema_version: '1.0', units: 'in', measurement_source: 'illustrative_estimate', body,
    preferences: {
      category: input.preferences.category,
      fit: input.preferences.fit,
      query: boundedText(input.preferences.query, 'What you are looking for', 500, true),
    },
    limit: 3,
  };
}

export function buildRecommendationRequest(measurementsCm, preferences = {}) {
  record(measurementsCm, 'Generated measurements');
  record(preferences, 'Preferences');
  if (Object.keys(preferences).some(key => !['category', 'fit', 'query'].includes(key))) {
    throw new Error('Preferences contains an unsupported field.');
  }
  // Explicit mapping deliberately omits weight, ancestry, gender, and other
  // form inputs. Never spread the full form profile into an API request.
  const body = Object.fromEntries(Object.entries(BODY_FIELDS).map(([key, [source]]) => {
    const value = measurementsCm[source];
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Missing or invalid generated measurement: ${source}.`);
    return [key, value / 2.54];
  }));
  return validateRecommendationRequest({
    schema_version: '1.0', units: 'in', measurement_source: 'illustrative_estimate', body,
    preferences: {category: 'short_sleeve_shirt', fit: 'regular', query: '', ...preferences}, limit: 3,
  });
}

function prepareCatalog(catalog) {
  record(catalog, 'Product catalog');
  if (catalog.units !== 'in' || catalog.measurement_basis !== 'finished_garment' || catalog.synthetic !== true) {
    throw new Error('The demo requires a synthetic catalog of finished garment measurements in inches.');
  }
  if (!Array.isArray(catalog.products) || !catalog.products.length || catalog.products.length > 500) {
    throw new Error('The product catalog must contain between 1 and 500 products.');
  }
  const seen = new Set();
  return catalog.products.map(item => {
    record(item, 'Catalog product');
    const id = boundedText(item.id, 'Product ID', 100);
    if (seen.has(id)) throw new Error('Catalog product IDs must be unique.');
    seen.add(id);
    if (typeof item.category !== 'string' || !Object.hasOwn(CATEGORY_LABELS, item.category)) throw new Error('Catalog product has an unsupported category.');
    if (!FITS.includes(item.silhouette) || !['none', 'low', 'moderate'].includes(item.stretch)) {
      throw new Error('Catalog product has an unsupported silhouette or stretch.');
    }
    if (!Array.isArray(item.tags) || item.tags.length > 20) throw new Error('Catalog tags must be an array of at most 20 strings.');
    if (!Array.isArray(item.sizes) || !item.sizes.length || item.sizes.length > 30) throw new Error('Catalog products need 1 to 30 sizes.');
    const seenSizes = new Set();
    const fields = item.category === 'pants' ? PANTS_FIELDS : TOP_FIELDS;
    return {
      id,
      name: boundedText(item.name, 'Product name', 200),
      category: item.category,
      description: boundedText(item.description, 'Product description', 1500),
      tags: item.tags.map(tag => boundedText(tag, 'Product tag', 80)),
      fabric: boundedText(item.fabric, 'Fabric', 500),
      stretch: item.stretch,
      silhouette: item.silhouette,
      sizes: item.sizes.map(entry => {
        record(entry, 'Catalog size');
        const size = boundedText(entry.size, 'Size label', 30);
        if (seenSizes.has(size)) throw new Error('Size labels must be unique within each product.');
        seenSizes.add(size);
        exactKeys(entry.measurements, fields, 'Garment measurements');
        return {
          size,
          measurements: Object.fromEntries(fields.map(key => [key, positiveNumber(entry.measurements[key], `Garment ${key}`, 0.1, 240)])),
        };
      }),
    };
  });
}

function fitPolicy(category, fit) {
  const topEase = {
    slim: {chest: [1.5, 5], upper_arm: [0.75, 3]},
    regular: {chest: [3, 8], upper_arm: [1.25, 4.5]},
    relaxed: {chest: [5, 13], upper_arm: [2, 7]},
  };
  const pantEase = {
    slim: {waist: [0.25, 2], hip: [1, 3.5], thigh: [0.75, 2.5]},
    regular: {waist: [0.5, 2.5], hip: [2, 5], thigh: [1.25, 3.5]},
    relaxed: {waist: [0.5, 3.5], hip: [3.5, 8], thigh: [2, 6]},
  };
  const selected = category === 'pants' ? pantEase[fit] : topEase[fit];
  const ease = Object.fromEntries(Object.entries(selected).map(([key, [min, max]]) => [
    key,
    // Hoodies allow extra room for a light layer; relaxed fit explicitly raises
    // the oversized allowance. Stretch never permits negative ease here.
    category === 'hoodie' ? [round(min + (key === 'chest' ? 2 : 0.5)), round(max + (key === 'chest' ? 3 : 1))] : [min, max],
  ]));
  return {
    method: 'Transparent heuristic screen, not a trained or calibrated fit prediction.',
    requested_fit: fit,
    garment_measurement_basis: 'finished_garment',
    body_measurement_basis: 'illustrative body estimates',
    circumferences: ['chest', 'waist', 'hip', 'thigh', 'upper_arm', 'hem'],
    lengths_or_widths: ['height', 'shoulder_width', 'inseam', 'sleeve_length', 'length'],
    ease_definition: 'Garment circumference minus estimated body circumference, in inches; never flat width.',
    acceptable_ease_inches: ease,
    inseam_tolerance_inches: category === 'pants' ? 1.5 : null,
    inseam_policy: 'Pants must be within 1.5 inches of the illustrative inseam estimate. The form does not establish exact measurement endpoints; this screen assumes comparable endpoints, similar rise, and full-length styling. Verify the actual crotch-to-hem length and intended break.',
    sleeve_and_shoulder_policy: 'Body shoulder and shoulder-to-wrist sleeve estimates may use different landmarks from garment charts and are not eligibility gates. Never compare a short sleeve length to a wrist-length body estimate. Check the brand measurement method and sleeve endpoint.',
    hem_and_length_policy: 'Top hem circumference and garment length are provided as catalog facts but not fit-tested: body torso length and circumference at the garment hem height are unavailable. Check hem clearance, particularly at the hips.',
    stretch_policy: 'No negative ease or numerical stretch allowance; stretch labels are descriptive only.',
    scoring: '0–100 heuristic closeness to the midpoint of accepted ease bands, plus inseam closeness for pants. A higher score is not a probability, confidence estimate, guarantee, or validated sizing result.',
  };
}

function makeCandidate(product, size, body, policy) {
  const comparisons = [];
  let weightedScore = 0;
  let totalWeight = 0;
  for (const [measurement, [minimum, maximum]] of Object.entries(policy.acceptable_ease_inches)) {
    const garment = size.measurements[measurement];
    const ease = round(garment - body[measurement]);
    if (ease < minimum || ease > maximum) return null;
    comparisons.push({measurement, body_inches: body[measurement], garment_inches: garment, ease_inches: ease});
    const midpoint = (minimum + maximum) / 2;
    const weight = ['chest', 'hip'].includes(measurement) ? 2 : 1;
    weightedScore += Math.max(0, 1 - Math.abs(ease - midpoint) / ((maximum - minimum) / 2)) * weight;
    totalWeight += weight;
  }
  const warnings = [];
  if (product.category === 'pants') {
    const delta = round(size.measurements.inseam - body.inseam);
    if (Math.abs(delta) > policy.inseam_tolerance_inches) return null;
    comparisons.push({measurement: 'inseam', body_inches: body.inseam, garment_inches: size.measurements.inseam, ease_inches: delta});
    weightedScore += Math.max(0, 1 - Math.abs(delta) / policy.inseam_tolerance_inches);
    totalWeight += 1;
    warnings.push('Confirm waistband rise and actual crotch-to-hem inseam against the product chart; the form does not establish exact body measurement endpoints.');
    if (Math.abs(delta) > 0.5) warnings.push(`The garment inseam is ${Math.abs(delta)} in ${delta > 0 ? 'longer' : 'shorter'} than the estimate; check the intended break and hem.`);
    if (size.measurements.waist - body.waist > 1.5) warnings.push('The waistband has more than 1.5 in of room; verify its rise and fastening, and whether adjustment is needed.');
  } else {
    warnings.push('Hem clearance and torso length have not been checked; verify length and room at the hips.');
    if (size.measurements.hem < body.hip) {
      warnings.push(`The ${size.measurements.hem} in hem is narrower than your ${body.hip} in hip estimate. It could feel tight if it reaches the hips; the hem position is unknown.`);
    }
    warnings.push(product.category === 'short_sleeve_shirt'
      ? 'Short sleeve length is not comparable to the shoulder-to-wrist body estimate. Check shoulder width and sleeve endpoint on the size chart.'
      : 'Shoulder width and sleeve length have not been matched because body and garment measurement methods may differ. Check the size chart.');
    if (product.category !== 'short_sleeve_shirt') {
      const sleeveDelta = round(size.measurements.sleeve_length - body.sleeve_length);
      if (Math.abs(sleeveDelta) > 2) {
        warnings.push(`The garment sleeve is ${Math.abs(sleeveDelta)} in ${sleeveDelta > 0 ? 'longer' : 'shorter'} than the arm estimate. Different measurement conventions and shoulder seams can change coverage; verify the sleeve endpoint.`);
      }
    }
    if (product.category === 'hoodie') warnings.push('The chest and upper-arm allowance includes room for a light layer; heavier layering needs a separate check.');
  }
  return {product_id: product.id, size: size.size, fit_score: round(weightedScore / totalWeight * 100), comparisons, warnings};
}

export function buildModelPayload(input, catalog) {
  const request = validateRecommendationRequest(input);
  const products = prepareCatalog(catalog);
  const fit_policy = fitPolicy(request.preferences.category, request.preferences.fit);
  const eligible_candidates = products
    .filter(product => product.category === request.preferences.category)
    .flatMap(product => product.sizes.map(size => makeCandidate(product, size, request.body, fit_policy)).filter(Boolean))
    .sort((a, b) => b.fit_score - a.fit_score || a.product_id.localeCompare(b.product_id) || a.size.localeCompare(b.size));
  return {
    ...request,
    catalog_version: typeof catalog.version === 'string' ? catalog.version : 'unversioned',
    catalog: products,
    fit_policy,
    eligible_candidates,
    limitations: [
      'Body measurements are illustrative estimates generated from the form, not measurements taken from your body. Confirm with a tape measure.',
      `All ${products.length} seed products are fictional examples. Their finished garment measurements are in inches; they are not live inventory or real brand size charts.`,
      'Fit scores rank a transparent ease heuristic, not a calibrated probability. Fabric drape, construction, stretch behavior, and personal comfort are not validated.',
      'Recommendations are possible matches to review, not fit guarantees. Check the relevant measurement methods and size chart before buying.',
    ],
  };
}

function hydrateRecommendation(candidate, payload, reason, warnings = []) {
  const product = payload.catalog.find(item => item.id === candidate.product_id);
  const selectedSize = product.sizes.find(item => item.size === candidate.size);
  const {sizes, ...details} = product;
  return {
    product_id: candidate.product_id,
    size: candidate.size,
    reason,
    warnings: [...new Set([...candidate.warnings, ...warnings])],
    product: {...details, measurements: {...selectedSize.measurements}},
    comparisons: candidate.comparisons.map(item => ({...item})),
    fit_score: candidate.fit_score,
  };
}

function queryMatchScore(product, query) {
  // A deterministic demo can honor simple descriptors without pretending to
  // understand arbitrary intent. In production Gemini interprets the query.
  const words = [...new Set(query.toLowerCase().match(/[a-z0-9]{3,}/g) || [])];
  const searchable = `${product.name} ${product.description} ${product.tags.join(' ')} ${product.fabric} ${product.silhouette}`.toLowerCase();
  return words.filter(word => searchable.includes(word)).length;
}

export function createDemoRecommendations(payload) {
  const productsById = new Map(payload.catalog.map(product => [product.id, product]));
  const ranked = [...payload.eligible_candidates].sort((a, b) => {
    const queryDelta = queryMatchScore(productsById.get(b.product_id), payload.preferences.query) - queryMatchScore(productsById.get(a.product_id), payload.preferences.query);
    return queryDelta || b.fit_score - a.fit_score || a.product_id.localeCompare(b.product_id);
  });
  const seen = new Set();
  const recommendations = [];
  for (const candidate of ranked) {
    if (seen.has(candidate.product_id)) continue;
    seen.add(candidate.product_id);
    const circumferences = candidate.comparisons.filter(item => item.measurement !== 'inseam');
    const easeDescription = circumferences.map(item => `${item.ease_inches.toFixed(1)} in of ${item.measurement.replaceAll('_', ' ')} room`).join(' and ');
    const reason = `For the ${payload.preferences.fit} fit you want, size ${candidate.size} provides ${easeDescription} beyond your estimated measurements. This could be a good option to try; check the fit notes for dimensions still to confirm.`;
    recommendations.push(hydrateRecommendation(candidate, payload, reason));
    if (recommendations.length === payload.limit) break;
  }
  return {
    provider: 'demo',
    summary: recommendations.length
      ? `${recommendations.length} possible ${recommendations.length === 1 ? 'match' : 'matches'} for your ${payload.preferences.fit} fit. Sample matching uses garment measurements and simple keywords from your request.`
      : 'No seed product sizes meet the measurement rules for this category and fit. Confirm your estimated measurements or try another fit; no recommendation has been forced.',
    recommendations,
    limitations: [...payload.limitations],
  };
}

export function validateModelRecommendations(raw, payload) {
  exactKeys(raw, ['summary', 'recommendations'], 'Model response');
  const summary = boundedText(raw.summary, 'Model summary', 1200);
  if (!Array.isArray(raw.recommendations) || raw.recommendations.length > payload.limit) {
    throw new Error('Model recommendations must be an array within the requested limit.');
  }
  const seen = new Set();
  const recommendations = raw.recommendations.map(item => {
    exactKeys(item, ['product_id', 'size', 'reason', 'warnings'], 'Model recommendation');
    const id = boundedText(item.product_id, 'Recommended product ID', 100);
    const size = boundedText(item.size, 'Recommended size', 30);
    if (seen.has(id)) throw new Error('Model recommended the same product more than once.');
    seen.add(id);
    const candidate = payload.eligible_candidates.find(entry => entry.product_id === id && entry.size === size);
    if (!candidate) throw new Error('Model recommended a product or size outside the eligible catalog candidates.');
    const reason = boundedText(item.reason, 'Recommendation reason', 1000);
    if (!Array.isArray(item.warnings) || item.warnings.length > 6) throw new Error('Model warnings must be an array of at most 6 strings.');
    const warnings = item.warnings.map(value => boundedText(value, 'Recommendation warning', 400));
    // The model cannot supply scores, product facts, or numerical comparisons.
    // Hydrate all such structured facts from server-computed catalog matches.
    return hydrateRecommendation(candidate, payload, reason, warnings);
  });
  return {provider: 'gemini', summary, recommendations, limitations: [...payload.limitations]};
}
