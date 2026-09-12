import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { PROTOCOLS, ACCEPTED, HEYMSFIELD, createPreviewModel, referenceScales,
  researchWaistWithAge, ellipseRadii, ellipsePerimeter } from './measurement-model.mjs';

const base = { height_cm: 170, weight_kg: 70, gender: 'female', ancestry: 'mixed',
  body_shape: 'unsure', belly: 'average', build: 'average', legs: 'average', arms: 'average', cup_size: 'B' };
// This is a synthetic rendering reference, not a calibrated reference subject.
const reference = { height_cm: 170, weight_kg: 70 };
const near = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const model = p => createPreviewModel(p, { reference });
const original = model(base);
assert.equal(Object.keys(original.measurements).length, 13);
for (const key of Object.keys(PROTOCOLS)) {
  if (!['height_cm', 'weight_kg'].includes(key)) assert.equal(original.measurements[key], null);
}
for (const ancestry of ACCEPTED.ancestry) assert.deepEqual(model({ ...base, ancestry }), original);
for (const cup_size of ACCEPTED.cup_size) assert.deepEqual(model({ ...base, cup_size }), original);
const heavier = model({ ...base, weight_kg: 80 });
near(heavier.reference_transform.vertical, 1);
near(heavier.reference_transform.transverse, Math.sqrt(8 / 7));
assert.equal(heavier.measurements.waist_cm, null);
const taller = model({ ...base, height_cm: 180 });
assert.ok(taller.reference_transform.vertical > 1 && taller.reference_transform.transverse < 1);
const k = 180 / 170;
const homothetic = referenceScales({ ...base, height_cm: 180, weight_kg: 70 * k ** 3 }, reference);
near(homothetic.transverse, k);
near(homothetic.vertical * homothetic.transverse ** 2, homothetic.relative_volume);
const longLegs = model({ ...base, legs: 'long' });
assert.equal(longLegs.visual_controls.relative_leg_length, 1);
assert.deepEqual(longLegs.measurements, original.measurements);
const apple = model({ ...base, body_shape: 'apple' });
const appleBelly = model({ ...base, body_shape: 'apple', belly: 'prominent' });
assert.equal(apple.visual_controls.central_prominence, appleBelly.visual_controls.central_prominence);
assert.equal(model({ ...base, body_shape: 'apple', belly: 'flat' }).visual_controls.central_prominence, -1);
const measured = { bust_cm: 101, waist_cm: 80, hip_cm: 110 };
const corrected = createPreviewModel(base, { reference, measured: Object.fromEntries(
  Object.entries(measured).map(([key, value]) => [key, { value, protocol: PROTOCOLS[key] }])) });
for (const [key, value] of Object.entries(measured)) {
  assert.equal(corrected.measurements[key], value);
  assert.equal(corrected.provenance[key], 'user_measured');
}
assert.equal(corrected.measurements.underbust_cm, null);
assert.throws(() => createPreviewModel(base, { measured: { inseam_cm: { value: 76, protocol: 'trouser-inseam' } } }));
assert.throws(() => model({ ...base, height_cm: '170' }));
assert.throws(() => model({ ...base, weight_kg: NaN }));
assert.throws(() => model({ ...base, height_cm: 139 }));
assert.throws(() => researchWaistWithAge(base));
assert.throws(() => researchWaistWithAge(base, 17));
for (const gender of ACCEPTED.gender) for (const height_cm of [140, 220]) for (const weight_kg of [35, 200]) {
  const scale = referenceScales({ ...base, gender, height_cm, weight_kg }, reference);
  assert.ok(Number.isFinite(scale.transverse) && scale.transverse > 0);
  near(scale.vertical * scale.transverse ** 2, weight_kg / 70);
}
for (const circumference of [65, 100, 140]) for (const ratio of [0.7, 1, 1.5, 2]) {
  const r = ellipseRadii(circumference, ratio);
  near(r.width_radius_cm / r.depth_radius_cm, ratio);
  near(ellipsePerimeter(r.width_radius_cm, r.depth_radius_cm, 16384), circumference, 0.0001);
}
near(ellipseRadii(100, 1).width_radius_cm, 100 / (2 * Math.PI), 0.00001);

const scenarios = [
  ['baseline', base, 'Reference transform identity; personal dimensions remain unknown.'],
  ['higher_mass', { ...base, weight_kg: 80 }, 'Vertical scale unchanged; transverse scale +6.9045%; no predicted waist.'],
  ['taller_same_mass', { ...base, height_cm: 180 }, 'Taller and transversely narrower at the same reference volume.'],
  ['long_legs', { ...base, legs: 'long' }, 'Leg direction +1; renderer must compensate torso to preserve height.'],
  ['pear', { ...base, body_shape: 'pear' }, 'Lower torso emphasis +1; no centimeter offset.'],
  ['apple_prominent', { ...base, body_shape: 'apple', belly: 'prominent' }, 'Central prominence remains +1; no stacked adjustment.'],
  ['male_example', { ...base, gender: 'male', cup_size: null }, 'Same geometry given the same reference; no invented sex coefficients.'],
];
const synthetic = { synthetic: true, reference_is_not_calibrated: true, scenarios: scenarios.map(
  ([id, input, expected_direction]) => ({ id, input, expected_direction, result: model(input) })),
  measured_override_example: corrected,
  conditional_research_example: { synthetic: true, age_years: 40, result: researchWaistWithAge(base, 40) } };
writeFileSync(new URL('./synthetic-profiles.json', import.meta.url), JSON.stringify(synthetic, null, 2) + '\n');
writeFileSync(new URL('./measurement-model.json', import.meta.url), JSON.stringify({
  version: original.version,
  intended_use: 'Approximate body preview; not a calibrated questionnaire predictor',
  units: { lengths: 'cm', mass: 'kg', research_age: 'years', render_controls: 'unitless directions' },
  form_ranges_are_not_validation_domains: { height_cm: [140, 220], weight_kg: [35, 200] },
  accepted_categories: ACCEPTED,
  protocols: PROTOCOLS,
  unsupported_personal_estimates: Object.keys(PROTOCOLS).filter(k => !['height_cm', 'weight_kg'].includes(k)),
  default_unknown_value: null,
  verified_numeric_questionnaire_adjustments: {},
  ancestry_policy: 'neutral for all categories', cup_policy: 'neutral without band and sizing system',
  geometric_fallback: { formula_vertical: 'height_cm / reference.height_cm',
    formula_transverse: 'sqrt((weight_kg / reference.weight_kg) / vertical)',
    coefficient_type: 'geometry, not fitted anthropometry', requires_explicit_reference: true,
    assumptions: ['unchanged density', 'global affine transform before local morphs'],
    individual_accuracy: null },
  conditional_research_equation: { ...HEYMSFIELD, current_questionnaire_eligible: false,
    automatic_waist_mapping: false, missing_input: 'age_years', measurement_protocol: 'source protocol unresolved',
    exponentiation_target: 'geometric-scale estimate; no smearing correction supplied' },
  rejected_or_deferred: [
    { name: 'Bartol 2022', source: 'https://github.com/kristijanbartol/linear-3d-humans',
      reasons: ['measurement conventions differ', 'saved-weight provenance unverified', 'repository labels license noncommercial research'] },
    { name: 'Bozeman 2012', source: 'https://link.springer.com/article/10.1186/1471-2288-12-115',
      reasons: ['age missing', 'separately fitted model without race/ethnicity not numerically published'] },
    { name: 'Vleugels 2022', source: 'https://www.mdpi.com/2076-3417/12/19/10158',
      reasons: ['age missing', 'malformed printed coefficients', 'logarithm base not specified in table'] },
  ],
}, null, 2) + '\n');
console.log('PASS: unknowns, protocol checks, overrides, ancestry/cup neutrality, scaling, semantic controls, ellipse geometry, and invalid-input handling.');
console.log('Wrote measurement-model.json and synthetic-profiles.json. No anthropometric accuracy validation performed.');
