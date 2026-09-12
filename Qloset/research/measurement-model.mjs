/** Qloset research adapter. Original code; no model weights or external dependencies.
 * Personal dimensions remain unknown unless supplied by the user.
 * Renderer transforms are geometric assumptions, not anthropometric predictions.
 */
export const VERSION = 'research-2026-09-12-v1';

export const PROTOCOLS = Object.freeze({
  height_cm: 'barefoot-floor-to-vertex-v1',
  weight_kg: 'body-mass-v1',
  bust_cm: 'horizontal-bust-prominence-v1',
  waist_cm: 'horizontal-rib-iliac-midpoint-normal-expiration-v1',
  hip_cm: 'horizontal-maximum-buttocks-v1',
  shoulder_width_cm: 'straight-biacromial-breadth-v1',
  inseam_cm: 'vertical-perineum-to-floor-v1',
  sleeve_length_cm: 'acromion-via-outer-elbow-to-ulnar-styloid-elbow30deg-v1',
  thigh_cm: 'maximum-upper-thigh-below-gluteal-fold-v1',
  upper_arm_cm: 'relaxed-acromion-olecranon-midpoint-v1',
  underbust_cm: 'horizontal-inframammary-fold-v1',
  neck_cm: 'below-larynx-perpendicular-to-neck-v1',
  belly_depth_cm: 'sagittal-abdomen-minus-underbust-anterior-positive-v1',
});

export const ACCEPTED = Object.freeze({
  gender: ['female', 'male'],
  ancestry: ['mixed', 'african', 'asian', 'european'],
  body_shape: ['rectangle', 'pear', 'apple', 'hourglass', 'inverted_triangle', 'unsure'],
  belly: ['flat', 'average', 'prominent'],
  build: ['soft', 'average', 'athletic'],
  legs: ['short', 'average', 'long'],
  arms: ['short', 'average', 'long'],
  cup_size: ['A', 'B', 'C', 'D', 'DD', 'F'],
});

function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  return value;
}
function positive(value, label) {
  finite(value, label);
  if (value <= 0) throw new RangeError(`${label} must be positive`);
  return value;
}

export function normalizeProfile(input) {
  const p = {
    ancestry: 'mixed', body_shape: 'unsure', belly: 'average', build: 'average',
    legs: 'average', arms: 'average', cup_size: null, ...input,
  };
  finite(p.height_cm, 'height_cm');
  finite(p.weight_kg, 'weight_kg');
  if (p.height_cm < 140 || p.height_cm > 220) throw new RangeError('height_cm outside form range');
  if (p.weight_kg < 35 || p.weight_kg > 200) throw new RangeError('weight_kg outside form range');
  for (const [key, values] of Object.entries(ACCEPTED)) {
    if (key === 'cup_size' && p[key] === null) continue;
    if (!values.includes(p[key])) throw new RangeError(`Unsupported ${key}: ${p[key]}`);
  }
  return p;
}

/** Unitless semantic directions. Renderer supplies its own visual amplitudes.
 * No centimeter, density, or body-fat coefficients have been fitted.
 */
export function visualControls(input) {
  const p = normalizeProfile(input);
  const length = { short: -1, average: 0, long: 1 };
  return {
    upper_torso_emphasis: p.body_shape === 'inverted_triangle' ? 1 : 0,
    lower_torso_emphasis: p.body_shape === 'pear' ? 1 : 0,
    waist_taper: p.body_shape === 'hourglass' ? 1 : p.body_shape === 'rectangle' ? -1 : 0,
    // One channel: flat/prominent wins; average retains the apple visual cue.
    central_prominence: p.belly === 'flat' ? -1
      : p.belly === 'prominent' || p.body_shape === 'apple' ? 1 : 0,
    surface_build: { soft: -1, average: 0, athletic: 1 }[p.build],
    relative_leg_length: length[p.legs],
    relative_arm_length: length[p.arms],
    ancestry_adjustment: 0,
    cup_adjustment: 0,
  };
}

/** Pure affine geometry, with no inferred reference dimensions.
 * vertical is the renderer's up axis; transverse applies to both other axes.
 * Before local morphs: determinant = weight / reference.weight.
 */
export function referenceScales(input, reference) {
  const p = normalizeProfile(input);
  positive(reference?.height_cm, 'reference.height_cm');
  positive(reference?.weight_kg, 'reference.weight_kg');
  const vertical = p.height_cm / reference.height_cm;
  const volumeRatio = p.weight_kg / reference.weight_kg;
  return {
    vertical,
    transverse: Math.sqrt(volumeRatio / vertical),
    relative_volume: volumeRatio,
    provenance: 'visual_reference_constant_density_assumption',
  };
}

/** Returns the requested measurement fields plus provenance.
 * measured entries must use { value: number, protocol: PROTOCOLS[key] }.
 * A null means unknown, including belly_depth_cm; it never means zero.
 */
export function createPreviewModel(input, { reference = null, measured = {} } = {}) {
  const p = normalizeProfile(input);
  const measurements = Object.fromEntries(Object.keys(PROTOCOLS).map(k => [k, null]));
  const provenance = Object.fromEntries(Object.keys(PROTOCOLS).map(k => [k, 'unknown']));
  for (const key of ['height_cm', 'weight_kg']) {
    measurements[key] = p[key];
    provenance[key] = 'user_supplied';
  }
  for (const [key, entry] of Object.entries(measured)) {
    if (!Object.hasOwn(PROTOCOLS, key)) throw new RangeError(`Unknown measurement ${key}`);
    if (key === 'height_cm' || key === 'weight_kg') {
      throw new RangeError(`Update ${key} in the profile so reference scaling also updates`);
    }
    if (entry?.protocol !== PROTOCOLS[key]) throw new RangeError(`Protocol mismatch for ${key}`);
    if (key === 'belly_depth_cm') finite(entry.value, key);
    else positive(entry.value, key);
    measurements[key] = entry.value;
    provenance[key] = 'user_measured';
  }
  return {
    version: VERSION,
    measurements,
    provenance,
    protocols: { ...PROTOCOLS },
    visual_controls: visualControls(p),
    reference_transform: reference === null ? null : referenceScales(p, reference),
    uncertainty: { calibrated: false, personal_prediction_intervals: null },
  };
}

export const HEYMSFIELD = Object.freeze({
  source: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2569934/',
  formula: 'exp(intercept + log_age * ln(age_years) + log_weight_over_height * ln(weight_kg / height_cm))',
  male: { intercept: 4.59, log_age: 0.11, log_weight_over_height: 0.66, log_residual_se: 0.05 },
  female: { intercept: 4.68, log_age: 0.07, log_weight_over_height: 0.64, log_residual_se: 0.06 },
});

/** Conditional research equation ONLY; never applied by createPreviewModel.
 * Needs age, which the current questionnaire does not collect.
 * Source-protocol ambiguity prevents automatic mapping to waist_cm.
 * Exponentiating the fitted log value gives a geometric-scale estimate;
 * no unreported retransformation/smearing correction is invented.
 */
export function researchWaistWithAge(input, ageYears) {
  const p = normalizeProfile(input);
  finite(ageYears, 'ageYears');
  if (ageYears < 18) throw new RangeError('Source model is for adults');
  const c = HEYMSFIELD[p.gender];
  const estimate = Math.exp(c.intercept + c.log_age * Math.log(ageYears)
    + c.log_weight_over_height * Math.log(p.weight_kg / p.height_cm));
  const factor = Math.exp(1.96 * c.log_residual_se);
  return {
    waist_source_protocol_cm: estimate,
    illustrative_log_residual_band_cm: [estimate / factor, estimate * factor],
    source: HEYMSFIELD.source,
    eligible_for_automatic_contract_mapping: false,
    limitations: ['waist protocol unresolved', 'external individual coverage unknown',
      'height/mass domain limits not established', 'gender-to-study-sex mapping is an assumption'],
  };
}

/** Polygon perimeter: mathematical helper, not an anatomical measurement. */
export function ellipsePerimeter(widthRadius, depthRadius, segments = 4096) {
  positive(widthRadius, 'widthRadius'); positive(depthRadius, 'depthRadius');
  if (!Number.isInteger(segments) || segments < 32 || segments > 65536) {
    throw new RangeError('segments must be an integer from 32 to 65536');
  }
  let sum = 0, x = widthRadius, y = 0;
  for (let i = 1; i <= segments; i++) {
    const theta = 2 * Math.PI * i / segments;
    const nextX = widthRadius * Math.cos(theta), nextY = depthRadius * Math.sin(theta);
    sum += Math.hypot(nextX - x, nextY - y);
    x = nextX; y = nextY;
  }
  return sum;
}

/** Fits a target circumference while preserving an EXPLICIT existing aspect ratio.
 * Returns half-width and half-depth in cm, not diameters.
 */
export function ellipseRadii(circumferenceCm, widthToDepthRatio) {
  positive(circumferenceCm, 'circumferenceCm'); positive(widthToDepthRatio, 'widthToDepthRatio');
  const unitPerimeter = ellipsePerimeter(widthToDepthRatio, 1);
  return {
    width_radius_cm: circumferenceCm * widthToDepthRatio / unitPerimeter,
    depth_radius_cm: circumferenceCm / unitPerimeter,
    provenance: 'geometry_fit_to_target_with_assumed_aspect_ratio',
  };
}
