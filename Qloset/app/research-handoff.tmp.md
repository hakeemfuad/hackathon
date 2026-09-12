# Qloset — temporary measurement research handoff

We are building a working browser tech demo before a presentation, with roughly 40 minutes remaining as of 17:16 UTC on September 12, 2026. The primary agent is implementing and publishing the frontend. Your bounded task is research on how questionnaire answers correspond to approximate body measurements. Return a useful first result within 10–15 minutes; do not wait for an exhaustive review.

## Product and responsibility

Qloset creates a simplified, rotatable 3D adult human body from a questionnaire. Body proportions are the priority. Gemini integration comes later; the current demo needs transparent deterministic defaults that research can replace. There is no clothing, shopping, social, fitness, or photo-upload scope.

Research only. Do not edit the application, initialize a Site, invoke Sites tools, install dependencies into the app, publish, or start another agent. Return findings and a standalone JSON/Markdown artifact. The primary agent will integrate it. The research brief already at `/Users/brittanyderasmo/Desktop/Qloset/clad-product-brief.md` contains source links and prior findings.

## Exact reference fields

The user explicitly chose the same questionnaire as https://clad.you/size-aware/size-me/. It currently exposes ten fields, despite eight-question marketing:

| UI field | Proposed code key | Accepted values |
|---|---|---|
| Height (cm) | height_cm | number, adult range 140–220 |
| Weight (kg) | weight_kg | number, adult range 35–200 |
| Gender | gender | female, male |
| Heritage | ancestry | mixed (UI: Prefer not to say), african (African / Caribbean), asian (Asian / Pacific Islander), european (European / Middle Eastern) |
| Body Shape | body_shape | rectangle, pear, apple, hourglass, inverted_triangle, unsure |
| Belly | belly | flat, average, prominent |
| Build | build | soft, average, athletic |
| Legs | legs | short, average, long |
| Arms | arms | short, average, long |
| Cup Size (female) | cup_size | A, B, C, D, DD, F |

Do not equate these broad self-reported categories with precise measurements. In particular, identify whether ancestry provides defensible individual-level information; leave it neutral when unsupported. Cup lettering without band size is ambiguous: research how to handle that without claiming a known bust circumference.

## Return contract

Provide a small framework-neutral JavaScript-compatible model: formulas, coefficients, and adjustments. Use centimeters and kilograms. Primary output fields:

```json
{
  "height_cm": 170,
  "bust_cm": 94,
  "waist_cm": 78,
  "hip_cm": 100,
  "shoulder_width_cm": 38,
  "inseam_cm": 80,
  "sleeve_length_cm": 56,
  "thigh_cm": 56,
  "upper_arm_cm": 29,
  "underbust_cm": 81,
  "neck_cm": 34,
  "belly_depth_cm": 0,
  "weight_kg": 70
}
```

The numbers above illustrate the shape only and are not a calibrated reference subject. Define exactly which anatomical landmarks each measurement uses. Distinguish body inseam (crotch to floor) from trouser inseam and shoulder breadth from a tape path across the back. Identify any output you cannot support; do not fabricate coefficients to fill the contract.

## Questions to resolve

1. Which accessible, primary anthropometric sources support estimating torso circumferences and limb lengths from height, mass, and the form's gender categories? Give original formulas or coefficients with their units and eligible population.
2. How should qualitative shape, build, belly, and limb proportions modify those estimates while avoiding double-counting correlated inputs? Distinguish evidence-backed adjustments from visual-only heuristics.
3. What errors and uncertainty ranges are defensible? Height/weight matching is not proof that unknown circumferences are correct. Include sample size and validation population where available.
4. What can be used immediately without training a new model, gated datasets, paid credentials, or heavy inference infrastructure?
5. How can directly measured waist/bust/hip later override prediction while preserving internally coherent proportions?

## Useful starting points

- https://clad.you/blog/posts/questionnaire-mlp/ — original questionnaire model and frank synthetic/real evaluation differences.
- https://clad.you/blog/posts/body-pipeline/ — pipeline and reconstruction limits.
- https://github.com/datar-psa/clad-body — measurement conventions and extraction; not a complete questionnaire predictor.
- The Bartol regression paper and public coefficients cited in the questionnaire post; inspect its actual population and definitions before reusing results.
- Public ANSUR/CAESAR documentation and other primary anthropometric sources if accessible. Do not treat population averages as precise individual predictions.

## Expected artifact

Return: (1) a concise recommendation for the demo, (2) implementable formulas/coefficients in JSON or JS, (3) citations immediately next to each supported rule, (4) unsupported fields and neutral handling, (5) a few clearly synthetic test profiles with expected directional changes. Give the primary agent the absolute artifact path. A partial, trustworthy model delivered quickly is preferable to invented precision.
