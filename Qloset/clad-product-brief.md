**Clad — product and technical understanding**

Reviewed September 12, 2026. This brief combines direct browser inspection, official product pages, public API documentation, engineering posts, the public measurement repository, and official app listings. Statements about internal operations are attributed to Clad; suggested implementation structure is explicitly identified as inference. No private application source or production infrastructure was available.

Clad's current positioning centers on a reusable digital body that can support several products. Its existing social shopping experience also has a separate photo-based workflow. These should be treated as related systems with different inputs, outputs, and accuracy requirements. [Product overview](https://clad.you/)

| Product | User outcome | Evidence and maturity |
|---|---|---|
| Social fitting rooms | Preview clothing on a personal photo and decide with friends | Public example gallery and onboarding inspected; iOS and Chrome listings verified |
| Size Me | Generate a body mesh, inspect measurements, correct the profile | Supplied demo body loaded successfully in the browser |
| Size-aware try-on | Compare garment sizes on a measured body | Advertised as live; an end-to-end simulation did not complete in this inspection |
| Developer API | Obtain meshes, measurements, and refined body parameters | Public Swagger reference inspected; authenticated calls not executed |
| Bespoke tailoring | Commission clothing from a body specification | Early customer batches, with email-based access |
| Fitness | Follow body changes and eventually explore projections | Mixed maturity: tracking advertised as live; composition and projections unfinished |

**1. The consumer experience**

The core social journey is: choose a model photo, create an occasion-specific fitting room, add garments from retailers, receive generated previews, collect feedback, and follow the retailer link to buy. A room groups the person, occasion, clothing candidates, results, and conversation. Each room may use a different photo. Friends can vote Love/Skip, leave threaded Style Notes, and contribute products from their own shopping. The FAQ calls the rendering technology Gemini VTO. The exact production model/version is not disclosed. [FAQ](https://clad.you/faq/)

The public social page demonstrates this with a cocktail-dress room. It separates the original person's image, labeled “The Muse,” from a gallery of generated looks. Gallery entries retain price and merchant links across several stores. This is a useful demonstration of the product's browsing and comparison concept, but it is a pre-existing showcase rather than a generation I performed. [Social product and example gallery](https://clad.you/social)

Onboarding opens a photo dialog with good/bad examples, drag-and-drop, and a phone-upload QR option. Guidance asks for a full body, permits mirror selfies, and favors fitted clothing. The app's sidebar exposes photos, body models, new rooms, language, appearance, and account controls. The observed design uses dark brown backgrounds, peach buttons, rounded cards, prominent typography, and large images. English and Polish controls are present. [Live application](https://clad.you/app)

**2. How products enter the system**

Mobile users create a room and mark it active. Sharing a product from another shopping app or browser sends it to that room; processing happens in the background. Invitations use room links, and feedback can arrive while shopping continues. The mobile guide presents native iOS distribution and installation as a PWA on Android. [Mobile guide](https://clad.you/how-it-works/mobile/)

On desktop, the extension adds a right-click action on garment images and routes them to the active room. The guide describes cross-device synchronization with the same account. [Extension guide](https://clad.you/how-it-works/extension/)

The official Chrome listing was reachable and identifies version 0.0.1, updated January 13, 2026. It describes room contributions, votes, notes, and merchant purchase links. The iOS listing was also reachable, lists the app as free and 18+, and describes sharing individual generated images to other apps. Its displayed latest version was 1.4.10. Neither extension installation nor native-app operation was tested. [Chrome listing](https://chromewebstore.google.com/detail/clad/coefnnjjnmkjbefdnchahkfcejdjdpgf), [iOS listing](https://apps.apple.com/us/app/clad-try-on/id6757544050)

**3. Body creation and editing**

The live questionnaire exposes height, weight, gender, heritage, body shape, belly, build, relative leg length, relative arm length, and cup size. It therefore has more visible fields than the headline's eight-question description. Six presets cover petite, hourglass, curvy, athletic, average, and stocky examples.

Selecting the supplied hourglass example displayed a 3D body with colored measurement contours and nine standard measurements. Controls included rotation, contour visibility, entering actual measurements, saving, and using the profile for try-on. A saved-profile view exposed measurement subsets for garment categories, additional measurements, tuning, sharing, and profile management. The photo tab required Google or Apple sign-in.

The demo established that the viewer and measurement interface work. It did not establish personalized prediction accuracy. The try-on transition and subsequent demo entry returned to body setup after loading/tuning states; I did not obtain a completed garment simulation. This is a session observation, not a diagnosis of a site-wide outage. [Size Me](https://clad.you/size-aware/size-me/)

**4. What size-aware simulation adds**

Clad describes fitting actual garment sewing patterns at multiple sizes to the body mesh. Fabric stretch, weight, drape, and friction are inputs to the proposed simulation. The output is intended to reveal changes in tightness, pulling, and drape between sizes. Retailer integration depends on brands supplying garment data. The public material does not identify the complete simulation engine, garment import formats, production catalog coverage, or validation against worn garments. [Size-aware product](https://clad.you/size-aware/)

The practical consequence is fundamental: receiving an arbitrary product link is sufficient to attempt an appearance preview, but does not itself provide the physical construction data needed for trustworthy fit prediction. A build needs an explicit distinction between products with imagery only and products with validated garment geometry and material information.

**5. The published body pipeline**

Clad's engineering post describes two routes converging on an Anny body representation:

```text
Questionnaire → learned parameter predictor → Anny body
Photo → SAM 3D Body → MHR → custom conversion → Anny body
                                            ↓
                       Measurements → user correction/tuning
                                            ↓
                           garment physics and fit output
```

The photo path reportedly runs on Google Cloud Run with an L4 GPU. The March/April post reports roughly $0.09 raw infrastructure cost per reconstruction and about five minutes per successful job, with around 80 seconds of actual compute; cold starts account for much of the remainder. It separately reports roughly one minute and $0.01 of GPU cost for garment draping. These are historical infrastructure figures, not current prices or complete unit economics. Its early photo evaluation reports approximately 5–8 cm mean absolute error across bust, waist, and hips, based on very few real participants. [Body-pipeline engineering post](https://clad.you/blog/posts/body-pipeline/)

The questionnaire post describes separate male/female networks with two 256-unit hidden layers, predicting 58 selected Anny parameters. Training uses synthetic bodies and losses that account for resulting height, mass, and waist. CPU inference is reported below a second. Its detailed table gives circumference mean errors of about 2.7–4.9 cm depending on measurement and group, with substantially larger tail errors. The article explicitly describes the result as a statistical body estimate; matching known measurements is a later tuning step. Matching user-supplied height and weight closely should not be interpreted as proving that unprovided body dimensions are correct. [Questionnaire engineering post](https://clad.you/blog/posts/questionnaire-mlp/)

**6. Public developer contract**

The Swagger documentation specifies bearer API keys and these operations:

| Operation | Behavior |
|---|---|
| `POST /v1/body/from-questionnaire` | Synchronous body generation |
| `POST /v1/body/from-photo` | Photo and height input; asynchronous job |
| `POST /v1/body/measure` | Measurements from existing parameters |
| `POST /v1/body/tune` | Parameters plus target measurements; asynchronous refinement |
| `GET /v1/jobs/{job_id}` | Job-status polling |

Body responses include a base64 GLB mesh, measurement dictionary, reusable versioned parameter string, and quota information. Photo and tuning requests return job IDs and polling URLs. The current documented free allowance is 10 photo requests and 50 questionnaire/measure/tune requests per key per week, resetting Monday at 00:00 UTC. Polling is free; failed asynchronous jobs do not refund their quota. [Public API reference](https://api.clad.you/)

The developer page explicitly says garment rigging/draping must be supplied separately when using its body API for virtual try-on. Higher-volume pricing is contact-based. Its photo-retention statement specifies automatic deletion of uploads and reconstruction intermediates after 24 hours, while retaining job metadata. These statements describe the API and should not be extended automatically to stored consumer model photos. [Developer product](https://clad.you/developers)

**7. What is open source**

The public `clad-body` package provides body loaders, measurement extraction, presets, metadata, and a differentiable measurement path for optimization. Its current README lists 25 measurements, including ISO, tailoring, and derived quantities; this differs from the site's simpler description of 24 ISO measurements. The library normalizes geometry and implements details such as anatomically positioned slices and tape-like circumference measurement. Its documented differentiable accuracy compares measurement algorithms on meshes, not inferred meshes against real people. It is not a publication of the entire consumer app or garment simulation system. [clad-body repository](https://github.com/datar-psa/clad-body)

Anny code and MHR use Apache 2.0, while SAM 3D Body has a separate SAM license. Anny's documentation also distinguishes optional noncommercial SMPL-X assets. Consequently, the site's “Apache-2.0 end to end” shorthand is insufficient to describe every possible photo-pipeline dependency. [Anny](https://github.com/naver/anny), [MHR](https://github.com/facebookresearch/MHR), [SAM license](https://github.com/facebookresearch/sam-3d-body/blob/main/LICENSE)

**8. Tailoring and fitness**

The tailoring page describes a workflow from body model to garment selection, fabric and pattern specifications, partner workshop, photographs, and shipping. It says the initial batch is being produced in Vietnam and offers email-based access to a subsequent batch. It promises re-cutting if fit is wrong. I found no public self-service ordering catalog, prices, lead-time commitment, or completed order flow. [Tailoring](https://clad.you/tailor)

The fitness page labels repeated weight/circumference tracking live, body composition and target-weight visualization coming soon, and pregnancy projection in research. It invites beta feedback and acknowledges that most of the page is still in development. A mature longitudinal dashboard and the projections were not independently demonstrated. Its pregnancy status also conflicts with the more assertive trimester-fit presentation on the size-aware page. [Fitness](https://clad.you/fitness)

**9. Commercial model and handling of personal data**

The stated consumer model is free access supported partly by affiliate commissions. The privacy policy identifies Skimlinks for attribution and Umami for website analytics. It says photos and generated images are not shared with retailers and are not used for foundation-model training; authorized staff may review content for troubleshooting or safety. It describes sensitive-data processing, account-lifetime retention in general, and deletion requests. These are published policies, not controls verified by a security audit. Its affiliate-cookie disclosures also qualify the footer's broad no-tracking message. [Privacy policy](https://clad.you/privacy)

The terms describe Google Vertex AI processing in Belgium, merchant checkout as a separate retailer relationship, and no guarantee that a physical garment matches the visualization. They also distinguish personal use of consumer renderings from broader commercial activity. The EULA covers the proprietary mobile application and repeats the absence of an accuracy warranty. These consumer terms are distinct from the open-source library licenses. [Terms](https://clad.you/terms), [EULA](https://clad.you/eula)

Revenue opportunities visible in the product are affiliate referrals, higher-volume API use, brand integrations, and bespoke garment sales. No public evidence establishes the revenue or profitability of these channels.

**10. Implications for an independent build — architectural inference**

A comparable product separates naturally into the following responsibilities. This is a proposed decomposition, not a claim about Clad's private code:

| System | Responsibility |
|---|---|
| Identity and personal assets | Accounts, permissions, model photos, body-profile versions, consent and deletion |
| Product ingestion | URLs, shared images, merchant metadata, deduplication, source attribution, failed imports |
| Visual try-on | Background generation jobs, input checks, result storage, retries, cost control |
| Social rooms | Room membership, active-room routing, results, votes, comments, contributions |
| Commerce | Merchant links, affiliate attribution, price freshness, availability |
| Body modeling | Questionnaire/photo inference, meshes, measurements, user correction, versioning |
| Physical fit | Per-size garment geometry, fabric parameters, simulation, fit interpretation |
| Platform API | Keys, quotas, asynchronous status, schemas, compatibility, usage accounting |
| Operational extensions | Tailoring specifications and fulfillment; historical body observations and experimental projections |

The conceptual records would include User, Photo, BodyProfileVersion, MeasurementSet, Room, Membership, Product, ProductVariant, GarmentAsset, TryOnJob, Result, Vote, Comment, APIKey, and UsageRecord. A result should retain its input photo/body version and garment version so later edits do not silently change what an earlier preview meant.

An appearance-focused initial product can deliver the photo → product → preview → feedback → merchant loop without solving cloth physics. A fit-focused initial product needs a bounded garment catalog, reliable body measurements, and physical validation from the outset. These are different product commitments even if they share the same room interface.

**11. Remaining unknowns**

Public access did not establish the garment solver and calibration process, retail-data extraction reliability, current production rendering model, model-training weights and evaluation dataset availability, actual retention enforcement, full room permission semantics, paid pricing, operational capacity, or real-world size-selection performance. No personalized photo generation, authenticated API call, collaborative session with another participant, purchase, or finished physical-fit simulation was completed during this review.

The public blog index contains four posts: two body-engineering articles, a try-on landscape article explaining the move toward physical fit, and an editorial about personal uniforms. The landscape article helps explain the product direction; its competitor and market statistics were not independently audited here. [Blog index](https://clad.you/blog/), [Product-direction article](https://clad.you/blog/posts/virtual-tryon-comparison/), [Style editorial](https://clad.you/blog/posts/uniforms/)
