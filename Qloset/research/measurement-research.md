# Qloset measurement research handoff

September 12, 2026. Research only; no application changes. Read this file first, then `measurement-model.mjs` and `measurement-model.json` in this directory.

**Recommendation for the presentation:** retain a deterministic, editable mannequin and label it **“Approximate body preview.”** I did not verify a complete, immediately reusable predictor for these ten inputs and the requested measurement definitions. The attached module provides an honest measurement contract, geometric scaling from an explicitly supplied reference mannequin, qualitative controls, and verified conditional research equations. It deliberately leaves unsupported personal measurements `null`. This is a usable fallback framework, not a calibrated questionnaire predictor.

Do not replace the current demo's constants with a supposedly scientific coefficient set merely because its output looks plausible. If the renderer requires numbers, keep its existing reference dimensions as visual defaults; store their provenance as `visual_reference`, and distinguish them from measurements of the person. No new questionnaire question, training, service, or dependency is required for the fallback.

## What the source checks established

**Bartol et al. (2022).** Features: `[h, w, w/h², w*h, 1]`, with height in meters, weight in kg, and outputs in meters. BODY-fit+W contains 4,149 fitted SMPL bodies (1,474 male; 2,675 female); mass comes from mesh volume. Ranges: male 145–196 cm/40–130 kg; female 135–190 cm/30–130 kg. Table 6 chest/waist/hip MAEs, in cm: **3.03/3.95/2.80** for BODY-fit+W; **2.91/3.79/2.16** for ANSUR. These are dataset benchmarks, not Qloset guarantees. The 1.24 cm aggregate averages 15 dimensions. [Original paper, §§3–4 and Tables 1–6](https://www.mdpi.com/1424-8220/22/5/1885)

Its lengths do not match the requested contract: inside leg ends at the ankle; arm length is a straight landmark distance; ANSUR biceps are flexed. The paper's waist is a fixed lower-belly mesh slice. These cannot be relabeled as floor inseam, tape sleeve, relaxed upper arm, or natural waist. [Original definitions](https://mdpi-res.com/d_attachment/sensors/sensors-22-01885/article_deploy/sensors-22-01885.pdf?version=1646036830)

The [public inference code](https://github.com/kristijanbartol/linear-3d-humans/blob/main/demo.py) confirms the feature order and the final multiplication by 100. Its inline “without interaction terms” comment conflicts with its executable equation. Coefficients are in [the public `coefs` directory](https://github.com/kristijanbartol/linear-3d-humans/tree/main/coefs); the repository labels its [license](https://github.com/kristijanbartol/linear-3d-humans/blob/main/LICENSE) noncommercial scientific research. I have not established permission for inclusion in a published commercial demo, or which evaluated dataset produced those particular saved arrays. They are not bundled here. This is a concrete source limitation, not an instruction to delay the presentation.

**Clad's questionnaire evidence.** Its main error table is synthetic Anny evaluation; the separately mentioned real-person group has no disclosed sample count. Reported male/female bust MAEs are 4.9/2.7 cm, waist 4.3/4.0, hips 3.3/3.3; corresponding p95 errors reach 11.9 cm. These statistics cannot be transferred to Qloset. The ancestry benefit described in the post fixes an inconsistency between synthetic training blendshapes and inference; it does not validate individual anatomical offsets for the form's heritage labels. Its Bartol hip benchmark label also disagrees with the original Table 6. [Clad's original account](https://clad.you/blog/posts/questionnaire-mlp/)

**A small accessible equation, but it needs age.** Heymsfield et al.: `waist_cm = exp(a + b*ln(age_years) + c*ln(weight_kg/height_cm))`; male `[a,b,c] = [4.59,0.11,0.66]`, female `[4.68,0.07,0.64]`. Development: 479 men/1,020 women at a New York research center; log-scale SEs 0.05/0.06, R² 0.86. Age is missing from the form. Inconsistent group labels in the methods also leave waist-protocol mapping unresolved. The module exposes this separately, requiring explicit age. [Original equations 10–11 and methods](https://pmc.ncbi.nlm.nih.gov/articles/PMC2569934/)

Under Gaussian log-residual assumptions, `estimate × exp(±1.96*SE)` gives an illustrative residual band, **not** a validated individual interval. It omits coefficient, input, protocol and population uncertainty. That paper's volume-based hip and mid-thigh definitions also differ from Qloset's maximum girths. [Methods and model discussion](https://link.springer.com/article/10.1186/1743-7075-5-24)

**Other candidates do not solve the missing-input problem.** Bozeman et al. require age and publish a demographic model; their separately fitted model without race/ethnicity is available on request, not numerically specified in the article. Zeroing demographic terms is not that refitted model. Development: 4,641 adults, BMI ≤40. External ARIC validation: 3,806 men/4,967 women, age <70; the female median underprediction is 3.94 cm, and its middle 50% residual range is −0.79 to +8.47 cm. A near-zero average error is not individual accuracy. [Original paper](https://link.springer.com/article/10.1186/1471-2288-12-115)

Vleugels et al.'s sports-garment paper also requires age. Its PDF Table 1 literally prints stature-squared coefficients `−0000.301`, `−0000.8065`, and `−0000.5088`, while declaring stature in millimeters. These yield impossible values when read literally. I visually checked the table; this is not merely text extraction. The logarithm base is not specified there. Do not silently repair these expressions. Section 3.1 reports 4,194 training subjects (2,083 male/2,111 female), while the section introduction says 4,094. Validation is 37 people; chest RMSE male/female 2.47/4.93 cm and hip 2.91/4.95 cm. [Original paper and Table 1](https://www.mdpi.com/2076-3417/12/19/10158)

ANSUR II has public tabular data from 4,082 male and 1,986 female soldiers. It is a useful future training source after landmark alignment and civilian validation, rather than a ready-made predictor or representative civilian average. CAESAR-derived published studies can be read without obtaining the underlying licensed data, but that does not make those data or model assets freely available. [Army's ANSUR II release](https://www.army.mil/article/188601/for_good_measure_natick_releases_raw_data_from_army_wide_anthropometric_survey), [Bartol dataset inventory](https://www.mdpi.com/1424-8220/22/5/1885)

## Measurement contract to adopt explicitly

These are proposed Qloset definitions. They are not a claim of ISO certification. Store the protocol with every measured override. No universal conversion between different waist, shoulder, sleeve, or inseam conventions was verified.

| Output | Qloset landmark and method | Current questionnaire support |
|---|---|---|
| `height_cm` | Barefoot vertical floor-to-vertex height, upright head and body | User supplied; retain exactly |
| `weight_kg` | Body mass, preferably with minimal clothing | User supplied; retain exactly |
| `bust_cm` | Level tape circuit through bust/chest prominence, relaxed stance, no garment ease | Unsupported personal estimate |
| `waist_cm` | Level tape midway between lowest palpable rib and top of iliac crest at side, normal exhalation | Unsupported; do not substitute navel, minimum waist, or pants waist |
| `hip_cm` | Maximum level circuit over buttocks, feet together | Unsupported personal estimate |
| `shoulder_width_cm` | Straight biacromial breadth between shoulder acromion landmarks | Unsupported; not the tape path across back/C7 or outer deltoid width |
| `inseam_cm` | Vertical perineal crotch-to-floor height, barefoot | Unsupported; not crotch-to-ankle or trouser seam length |
| `sleeve_length_cm` | Body surface path from acromion over outside elbow to ulnar styloid, elbow flexed 30° | Unsupported; this explicit pose is a proposed Qloset protocol, with no garment ease |
| `thigh_cm` | Maximum upper-thigh circuit immediately below gluteal fold | Unsupported; not mid-thigh |
| `upper_arm_cm` | Relaxed arm circumference at midpoint between acromion and olecranon, tape perpendicular to arm | Unsupported; not flexed biceps |
| `underbust_cm` | Level circuit at inframammary fold directly below breast tissue | Unsupported; not a labeled bra band size |
| `neck_cm` | Circuit below laryngeal prominence perpendicular to neck axis | Unsupported personal estimate |
| `belly_depth_cm` | Qloset custom sagittal offset: most anterior midline abdomen between waist and hip planes minus anterior midline at underbust plane; positive means forward | Unsupported; unknown is `null`, not zero |

The original [Clad registry](https://github.com/datar-psa/clad-body#measurement-registry) supplies several related definitions but mixes midpoint/natural/navel language for waist and uses a shoulder tape path. Its belly-depth sign is negative for prominence, the opposite of the proposed Qloset convention. A future Clad adapter must convert explicitly. Body dimensions need consistent pose, tape tension, and breathing; differing waist sites have measurably different values. [Primary comparison of waist sites](https://pmc.ncbi.nlm.nih.gov/articles/PMC3661855/)

## How the questionnaire should affect the demo

**Evidence-backed numeric questionnaire offsets verified in this loop: none.** Shape descriptions can drive a visual preview without being treated as centimeter corrections. The following mappings are engineering choices, implemented as unitless directions in the module; their magnitudes are intentionally left to the renderer's existing controls.

| Input | Render-only behavior | Avoid double counting |
|---|---|---|
| Height + mass | Scale an explicit reference using `vertical = H/H₀`, `transverse = sqrt((W/W₀)/(H/H₀))` | One overall size operation; don't add a second BMI fat multiplier |
| Pear / inverted triangle | Shift emphasis toward lower / upper torso | Do not apply a second unvalidated bust/hip ratio formula |
| Hourglass / rectangle | More / less waist taper | No claim of particular BWH ratios; unsure is neutral |
| Apple + belly | One shared central-prominence control; explicit flat/prominent belly overrides apple's default | Do not add an apple waist increase and another belly waist increase |
| Build | Softness or muscular surface contour | No inferred body-fat %, density, or extra mass; no automatic arm girth increment |
| Short/long arms or legs | Unitless relative length direction | Compensate leg versus torso lengths to preserve total height; no assumed ±cm |
| Heritage | Same numerical and visual output for every accepted value | No skin tone, facial, skeletal, or body-density inference |
| Cup | Neutral without band and sizing system | Do not add 2.54 cm per cup or infer underbust |

The scaling equation follows directly from the determinant of an affine transform: `vertical × transverse² = W/W₀`. It matches a reference-volume ratio under an unchanged-density assumption. It does not establish the person's circumferences or body composition, and subsequent local morphs can change that volume. This is our geometric fallback, without fitted anthropometric coefficients.

Cup letters depend on the band and sizing convention; UK and US sequences diverge beyond DD. Even a full bra size is a sizing constraint rather than a direct bust measurement. Prefer actual bust and underbust measurements later. [Manufacturer sizing systems](https://wacoal-america.com/pages/size-charts), [manufacturer explanation of band/cup relationships](https://www.wacoalindia.com/blogs/stories/sister-sizes-in-bras-what-they-are-how-they-help)

Keeping heritage neutral is a finding about the lack of validation for these particular broad categories, not a claim that population distributions are identical. The available evidence does not support converting “Asian / Pacific Islander” or “European / Middle Eastern” to calibrated individual offsets. Likewise, the form's gender labels select a reference style; they do not establish an individual's anatomy or body composition.

## Direct measurements and coherent geometry

Keep three things distinct: user measurements, statistical candidates, and dimensions extracted from the rendered mesh. Apply supplied BWH measurements as hard target constraints at their declared planes. In the attached module, overrides win exactly and carry `user_measured` provenance. Unknown unrelated fields remain unknown.

For an elliptical cross-section with an existing width-to-depth ratio `r`, solve its scale so that its perimeter equals the target circumference. The provided `ellipseRadii` helper performs numerical perimeter integration and uniform scaling; it never sets width to circumference/π unless the caller deliberately selects a circle. Interpolate scale between measurement planes smoothly. Preserve measured anchor rings, keep vertical height fixed, and remeasure the resulting mesh at the same planes. Validate the actual mesh for intersections and unrealistic transitions.

Circumference alone does not determine width versus depth, breast distribution, or belly projection. Keep unmeasured ratios as visual assumptions, editable later. Do not enforce waist < hip or a fixed bust-minus-underbust difference as universal rules. When exact circumference targets conflict with the mass proxy, preserve supplied measurements and treat estimated mesh mass as a soft diagnostic; do not globally rescale away the user's corrections.

## Deliverables and validation

Example integration (the reference below is explicitly synthetic):

```js
import { createPreviewModel, PROTOCOLS } from './measurement-model.mjs';
const result = createPreviewModel(questionnaireAnswers, {
  reference: { height_cm: 170, weight_kg: 70 },
  measured: { waist_cm: { value: 80, protocol: PROTOCOLS.waist_cm } },
});
// result.measurements.waist_cm is exactly 80; unmeasured girths remain null.
// result.reference_transform and visual_controls are separate rendering inputs.
```

Select the renderer's existing reference explicitly; the module does not supply a calibrated male or female reference. It does not implement the renderer, local morph amplitudes, or a complete mesh-fitting solver.

- `measurement-model.mjs`: zero-dependency ES module; semantic controls, explicit reference scaling, measured overrides, ellipse helper, conditional research waist formula. No personal measurements fabricated.
- `measurement-model.json`: units, sources, exact verified conditional coefficients, unsupported fields, and use restrictions.
- `synthetic-profiles.json`: generated arithmetic examples and direction checks, explicitly synthetic.
- `verify-model.mjs`: runnable contract, scaling, override, neutrality, and geometry checks. These validate software behavior, not anthropometric accuracy.

Before promoting any fallback to a predictor, validate on an independent set of adults measured with this exact protocol. Report per-field MAE, signed bias, error quantiles, missing predictions, and performance by size range; reserve final testing from calibration. Out-of-population inputs and the form's extreme height/mass combinations must not inherit benchmark error claims. There is currently no defensible Qloset 95% interval.
