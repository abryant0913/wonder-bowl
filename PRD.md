# Product Requirements Document (PRD): WonderBowl MVP Testing Site

**Product Name:** wonder-bowl.com MVP "Painted Door" Website
**Author:** Project Leopold Agent Council

---

## 1. About

The TLDR of this product is to provide a highly focused, minimal viable landing
page (wonder-bowl.com) to seamlessly convert traffic from four distinct Meta Ad
tests into trial sign-ups. The site acts as a "painted door" that skips heavy
e-commerce architecture in favor of a fast, data-capturing sample fulfillment
tool to validate product-market fit and identify the winning brand narrative.

## 2. Market Insights

- **Market Analysis:** The fresh dog food market is rapidly growing but largely
  saturated by meat-heavy offerings. There is a distinct whitespace for a
  premium, vibrant, and deeply empathetic plant-forward brand.
- **Competitor Analysis:** Major fresh dog food competitors (NomNom, Ollie,
  Bramble) utilize extensive, 20-question onboarding pet profiles that create
  high user friction.
- **Customer Segments:** High-income, eco-conscious dog guardians based in San
  Francisco.

### User Personas

- **The Compassionate Convert:** Pro-fresh and plant-forward; cares deeply about
  sustainability, human-grade ingredients, and ethical sourcing.
- **The Cautious Carnivore:** Feeds their dog meat or kibble; skeptical about
  plant-based diets, highly concerned about palatability, and terrified of
  sudden transitions causing explosive diarrhea.

## 3. The Problem

- **Use Cases:** Capturing user details from 4 different ad streams to deliver a
  localized, at-cost dog food sample.
- **Pain Points:** Consumers are intimidated by massive dietary shifts and fear
  GI issues from sudden transitions. Furthermore, long competitor sign-up forms
  lead to massive conversion drop-off.
- **Problem Statement:** How do we build a singular, temporary MVP landing page
  that simultaneously addresses the transition fears of kibble-feeders and
  validates the specific ad narrative a user clicked, all while capturing minimal
  fulfillment data?
- **Hypotheses and Mission Statement:** We hypothesize that explicitly
  positioning the sample as a "2-Day Taste Test" (a 50/50 mix-in with their
  current food) will lower the barrier to entry and alleviate transition fears.
  Our mission is to definitively prove whether ingredient focus, ethical
  nutrition, local freshness, or the founder's story drives cheaper, higher-intent
  conversions.

## 4. The Solution

### Feature Prioritization (The MVP Scope)

- **Silent Ad Tracking:** The URL must accept UTM parameters to silently track
  which of the 4 tests the user clicked from.
- **Dynamic Hero Block:** A high-res photo of the "Darker Bowl" recipe with a
  strong headline — ideally swapping dynamically based on the ad clicked.
- **"The 2-Day Taste Test" Block:** A crucial section explicitly stating the set
  includes "1 reusable glass bowl (half-filled) + 3 eco-paper refills" to
  encourage a gentle, 50/50 mix with the dog's current food.
- **Recipe Dropdown:** A breakdown of the "Deep Vitality" dark recipe featuring
  Lentils, Mushrooms, Chickpea, Carrots, Squash, and Cranberries. Must include
  "Vet-Reviewed" and "Exceeds AAFCO Standards" trust badges.
- **Frictionless Capture Form:** A single-page checkout asking only for human
  name, email, SF delivery address, dog's name, and dog's size (Small, Medium,
  Large).

### Roadmap

Launch this single-page MVP exclusively for local SF residents to test the core
concept. Post-MVP, expand to e-commerce subscription management.

### Technical Architecture

A lightweight website builder integrated with a custom form that logs hidden
parameters and has the Meta Pixel base code installed in the header.

### Risks & Constraints

Users might feel short-changed by receiving a "half-full" bowl if the
educational transition copy isn't explicitly clear.

## 5. Requirements

- **Functional Requirements:** The site must successfully pass the hidden Meta ad
  source parameter to the database upon form submission. The form's "Dog Size"
  dropdown must trigger appropriately sized fulfillment batches.
- **Non-functional Requirements:** The aesthetic must reflect the premium, warm,
  and artisanal "Bowls of Bow-wow-nty" tone without feeling like a sterile
  clinical diet.
- **Data Requirements:** Secure intake of the user's local SF delivery address
  and personal email for manual ghost-kitchen delivery.

## 6. Challenges

We must perfectly bridge the gap from 4 very different ad narratives:

1. **Ingredient Focus** — *Everything dogs need. Nothing they don't.*
2. **Ethical Nutrition** — *Unlike wolves, dogs evolved to thrive on plants.*
3. **Local Freshness** — *Simmered in San Francisco this week.*
4. **Leo's Story** — *3 years post cancer-scare, still begging for seconds.*

The ultimate challenge is designing a singular landing page that feels like a
natural continuation for a user arriving from any of those four distinct entry
points.

## 7. Positioning

- **Use Case:** Seeking a premium, healthy dog food alternative without risking
  an immediate dietary disaster.
- **Pain Point:** Fear of canine digestive issues during a diet transition and
  form-fatigue from competitors.
- **Possible Solutions:** The "2-Day Taste Test" framing to position the food as
  a 50/50 mix-in "topper".
- **Impact of Solution:** Instantly removes the primary barrier to trial for
  skeptical meat-feeders, widening the addressable market safely.

## 8. Measuring Success

- **Metrics:** Landing page form completion rate and qualitative reactions from
  the beta-tasting cohort.
- **North Star Metric:** Customer Acquisition Cost (CAC) and the total volume of
  successful at-cost sample sign-ups mapped definitively to their winning Meta ad
  variant.

## 9. Launching

- **Stakeholders & Communication:** Coordination with local SF ghost kitchens to
  dictate preparation batches based on the daily ratio of Small, Medium, and
  Large dog sign-ups.
- **Roll-out strategy:** Deploy the adcepts dynamically linked to this specific
  URL. Utilize the Meta Pixel Helper extension to verify the hidden code is
  actively tracking page views before spending ad dollars.
