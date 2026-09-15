# Kabadiwala Connect

> A vernacular, offline-tolerant digital bridge between informal e-waste collectors and the formal recycling ecosystem.

Kabadiwala Connect helps waste-pickers, scrap dealers, and local aggregators make the formal recycling route easier to understand and more rewarding. It combines fair-price discovery, material lot creation, authorized recycler matching, traceable handovers, safety guidance, and an earnings ledger in a lightweight web application designed for low-connectivity field conditions.

## 1. Challenge Context

The majority of India's end-of-life electronics reaches the recycling economy through informal collectors because they have the strongest last-mile reach and the lowest collection cost. These collectors are essential to the system, but they often remain outside the formal Extended Producer Responsibility ecosystem established by the E-Waste (Management) Rules, 2022.

This gap creates several problems:

- Collectors may not know the fair buying price for copper, PCBs, batteries, CRTs, motors, magnets, displays, or mixed plastics.
- They may not know which nearby facilities are authorized to accept a particular material.
- Handover and payment records are often informal, incomplete, or difficult to verify later.
- Low-value or inconvenient formal handovers can push material toward unsafe backyard processing.
- Open-air cable burning, acid leaching, uncontrolled desoldering, and unsafe battery or CRT handling expose workers and communities to serious risks.
- Valuable elements such as lithium, cobalt, neodymium, tantalum, gallium, and indium can be lost during unsafe processing.

The barrier is not only technological. It is also informational and institutional. Kabadiwala Connect is designed to make the formal channel convenient, understandable, and economically attractive without turning compliance into an additional burden for collectors.

## 2. Proposed Solution

The platform creates a simple digital bridge:

```text
Collector photographs material
        |
        v
Material lot + approximate weight + local price estimate
        |
        v
Nearby authorized recycler matching
        |
        v
Documented handover + recycler confirmation
        |
        v
Payment record + earnings ledger + traceability history
```

The core experience is designed around pictorial controls, large touch targets, vernacular language support, spoken guidance, offline capture, and minimal personal data collection.

## 3. What the Prototype Demonstrates

### Collector workflow

- Photograph or select a material sample.
- Categorize lots such as CRTs, LCD/LED panels, PCBs, cables, batteries, motors, magnet-bearing assemblies, and mixed plastics.
- Enter approximate weight and condition information.
- Receive an instant benchmark-based value estimate.
- Compare current and historical prices through a simple price board.
- Find suitable recyclers by accepted material, distance, offered rate, pickup availability, and authorization status.
- Queue a lot without connectivity and synchronize it later.
- Generate a digital receipt with a unique reference, timestamp, location, transaction details, and SHA-256 verification code.
- Review payments, pending dues, and completed transactions in an earnings ledger.

### Recycler workflow

- Review material categories and incoming lots.
- View collector-submitted material details and estimated values.
- Participate in a live bidding or offer workflow.
- Review compliance-oriented receipt and handover information.
- Maintain a recycler-side view of accepted materials, service area, pickup availability, and offered rates.

### CPCB/admin workflow

- Review benchmark and material datasets.
- Inspect transaction and validation summaries.
- Review field-research records and their evidence status.
- Export or inspect CPCB-oriented report views.
- Identify placeholder or pending field inputs rather than presenting them as verified research.

## 4. Requirement-to-Feature Mapping

| Challenge requirement | Kabadiwala Connect implementation |
| --- | --- |
| Photograph and categorize collected material | Snap Estimate workflow with material categories and image references |
| Approximate weight and instant valuation | Weight input combined with seeded benchmark rates and estimate calculations |
| Price discovery and trends | Price Guide with category rates, market ranges, quoted rates, seven-day history, and sparklines |
| Material and transaction traceability | SQLite-backed materials, receipts, lot references, timestamps, GPS fields, and status records |
| Authorized recycler discovery | Recycler dataset and filters for material, distance, rating, accepted materials, and pickup availability |
| AI/ML-assisted functionality | Gemini-backed server routes for optional price/material assistance plus validation-report structures |
| Spoken price and safety information | Voice guide helpers and language-aware safety workflows |
| Digital handover record | Digital receipt, QR verification code, manifest reference, photo reference, and GPS fields |
| Earnings history | Earnings Ledger with receipt, payment, and pending-status views |
| Hazard safety guidance | Pictorial/text safety guidance for batteries, CRTs, burning, fumes, and protective equipment |
| Hindi and Marathi support | English, Hindi, and Marathi UI controls and localized material content |
| Offline operation | IndexedDB queue, LocalStorage fallback, simulated offline mode, and reconnect replay |
| Entry-level Android suitability | Responsive browser UI, low-dependency client flow, and no mandatory digital payment or Aadhaar collection |
| Cash payments | Payment method is represented as part of a receipt; UPI is optional in the prototype |

## 5. Structured Datasets

The application is designed around datasets generated from both platform activity and field operations. The current prototype stores the operational tables in `kabadiwala.db` using `better-sqlite3`.

### Material Dataset

Stored in `materials` and represented in `src/data/mockData.ts`:

- Material category and sub-category
- Material key and description
- Sample image reference
- Approximate benchmark, minimum, and maximum price
- Unit of measurement
- Purity or condition benchmark
- Recoverable metals
- Hazard level
- Seven-day price history

Example categories include copper wire, high-grade and standard PCBs, lithium-ion batteries, lead-acid batteries, CRTs, LCD/LED panels, motors, hard drives, neodymium magnets, and flame-retardant plastics.

### Price Dataset

The price dataset is represented through material benchmark records and historical price arrays. A production deployment should expand this into a time-series table containing:

- Material category and sub-category
- City, district, and service location
- Date and time
- Prevailing buying price
- Selling or quoted price
- Unit
- Recycler or aggregator source
- Historical observations
- Data-quality and verification status

The current price board is a seeded prototype dataset, not a live market feed. Real deployments should ingest verified recycler or aggregator quotes and retain the source and timestamp for every observation.

### Recycler Dataset

Stored in `recyclers`:

- Recycler name and facility ID
- Facility address and GPS coordinates
- Materials accepted
- Authorization or registration reference
- CPCB certification status
- Contact and WhatsApp details
- Offered price bonus or rate information
- Minimum pickup weight
- Free pickup availability
- Service area and distance
- Rating and review count

The repository's demo records are illustrative. Authorization references must be independently verified before operational use.

### Transaction Dataset

Stored in `receipts`:

- Unique receipt and lot IDs
- Collector name, phone, and collector reference
- Material key and description
- Approximate weight
- Purity or condition grade
- Quoted rate and final price
- Recycler name and authorization reference
- Payment method and payment status
- Collection and creation timestamps
- CPCB manifest reference
- GPS latitude and longitude
- Photograph reference
- Transaction status

### Traceability Dataset

Traceability is represented through the receipt and hash fields:

- Lot and handover reference
- Photograph reference
- Weight and material category
- Timestamp
- GPS coordinates
- Recycler details
- CPCB manifest number
- Recycler confirmation fields
- SHA-256 QR verification code
- Current transaction status

The client canonicalizes the receipt payload before hashing. Changing a value such as weight or final price produces a different digest and can be surfaced through the hash-audit workflow.

### Collector Dataset

The prototype keeps a minimal local profile:

- Collector ID
- Preferred language
- General operating location
- Phone number used for the local session
- Transaction history
- Earnings history

The design intentionally avoids Aadhaar, invasive KYC, or unnecessary personal information. A production system would add explicit consent, retention rules, role-based access, and secure server-side authentication.

### AI/ML Training and Validation Dataset

The architecture leaves room for models that use:

- Material photographs and category labels
- Approximate weights and condition labels
- Local buying prices and quoted offers
- Location and service-area information
- Completed transaction outcomes
- Recycler matching results
- Abnormal-price or inconsistent-transaction labels

The current repository includes Gemini-backed routes and an ML validation log structure, but it does not claim to contain a production-trained classifier or a statistically representative field dataset. Before deployment, teams should document dataset source, consent, image quality, class balance, sample size, validation split, failure modes, and geographic limitations.

## 6. Data Lifecycle

```text
Capture
  -> Validate required fields
  -> Store locally when offline
  -> Sync when connectivity returns
  -> Normalize and hash receipt payload
  -> Persist transaction in SQLite
  -> Update ledger and validation history
  -> Use verified outcomes to improve price and matching datasets
```

Data-quality controls should include:

- Required-field validation for material, weight, price, time, and location
- Duplicate lot and receipt detection
- Outlier review for abnormal quoted or final prices
- Authorization-status verification for recycler records
- Anonymization or pseudonymization of collector identifiers
- Source and timestamp retention for price observations
- Explicit labeling of pending, demo, and field-unverified records

## 7. Safety and Responsible Handling

The safety module provides pictorial and language-aware guidance covering:

- Never burning cable insulation to recover copper
- Avoiding acid leaching and uncontrolled PCB processing
- Safe storage and handling of lithium-ion and lead-acid batteries
- CRT implosion and leaded-glass risks
- Respiratory, eye, hand, and fire protection
- Handover of hazardous material to authorized facilities

The objective is to make safe formal handover easier and more valuable than unsafe backyard processing.

## 8. Unit-Economics Hypothesis

The platform's economic model is designed around value retained and transactions enabled rather than charging collectors an access fee.

| Value driver | Existing informal route | With Kabadiwala Connect |
| --- | --- | --- |
| Price information | Often dependent on a middleman | Transparent benchmark and recycler offers |
| Recycler access | Personal network and travel | Ranked facilities with pickup information |
| Record keeping | Paper, memory, or no record | Digital receipt and earnings history |
| Payment visibility | Informal settlement risk | Recorded payment method and status |
| Material recovery | Incentive to strip or burn | Better incentive for documented authorized handover |

A practical sustainability model could combine a small recycler-side transaction fee, enterprise or EPR reporting subscriptions, sponsored collection campaigns, and verified logistics partnerships. Collector access should remain free or near-free, and cash transactions should remain supported.

The prototype does not claim a validated impact percentage or commercial unit economics. A field pilot should compare at least:

- Collector earnings per kilogram before and after platform use
- Time and travel cost per completed handover
- Recycler acquisition and pickup cost
- Payment delay and failed-transaction rate
- Platform cost per active collector
- Revenue per completed recycler transaction
- Share of lots routed to authorized facilities

## 9. Architecture and Technology

```text
React 19 + TypeScript + Vite + Tailwind CSS
        |
        | Responsive vernacular UI
        | IndexedDB offline queue
        | Web Crypto SHA-256 verification
        v
Express server with Vite middleware
        |
        | Materials, prices, recyclers, receipts,
        | field interviews, and ML validation routes
        v
better-sqlite3 persistent database
```

Technology stack:

- React 19
- TypeScript 5.8
- Vite 6
- Tailwind CSS 4
- Express 4
- `better-sqlite3`
- Google Gemini SDK (`@google/genai`)
- IndexedDB
- Web Crypto API
- Lucide React icons

## 10. Run Locally

### Prerequisites

- Node.js 22.5 or newer is recommended for the verified environment.
- npm 10 or newer is recommended.
- A Gemini API key is optional for non-AI flows.

### Install

```bash
git clone https://github.com/srishtipandey1/kabadiwala-connect.git
cd kabadiwala-connect
npm install
```

Create `.env` from `.env.example`:

```env
GEMINI_API_KEY=your_real_key_here
APP_URL=http://localhost:3000
```

Do not commit `.env` or real credentials.

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production

```bash
npm run build
npm start
```

The server initializes `kabadiwala.db` and serves the application on port `3000`.

### Windows path note

If the project is located in a Windows path containing `&`, npm's generated `.bin` wrappers may resolve incorrectly. The direct equivalents are:

```powershell
node .\node_modules\vite\bin\vite.js build
node .\node_modules\esbuild\bin\esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs
node .\node_modules\typescript\bin\tsc --noEmit
node .\dist\server.cjs
```

Moving the project to a path without `&` allows the standard npm scripts to run normally.

## 11. Demonstration Script

1. Open the app without a session and confirm that `/login` appears before any dashboard content.
2. Choose Collector, Recycler, or CPCB Admin.
3. Use the phone and PIN form or select a clearly labeled demo account.
4. Open Snap & Estimate and create a sample lot.
5. Open Price Guide to compare current benchmark values and seven-day trends.
6. Open Find Recycler to filter suitable facilities.
7. Enable Offline Shed mode and queue a lot.
8. Re-enable connectivity and replay the pending lot.
9. Open Digital Bills & Ledger to inspect the receipt and payment record.
10. Use the hash audit action to compare an original payload with a modified weight.
11. Open Safety & Training Guide for battery, CRT, cable, and PPE guidance.
12. Switch to Recycler or CPCB Admin to demonstrate role-specific views.

## 12. API Surface

The Express server currently exposes routes including:

- `GET /api/materials`
- `GET /api/prices`
- `GET /api/recyclers`
- `GET /api/receipts`
- `POST /api/receipts`
- `GET /api/field-interviews`
- `GET /api/ml-validation`

Gemini-assisted routes require `GEMINI_API_KEY`. The rest of the prototype remains available without an API key.

## 13. Current Prototype Boundaries

This repository demonstrates the product workflow but is not yet a production public-service deployment. Before a live rollout, it needs:

- Real field research with consent from at least two working collectors or aggregators
- Verified recycler authorization data and an update process
- A production authentication and authorization service
- Secure server-side session storage and audit controls
- A validated material-image and price training dataset
- Model evaluation across languages, lighting, device quality, and material conditions
- Real payment and cash-settlement reconciliation
- Independent legal, safety, and CPCB compliance review
- Pilot measurement of collector earnings, adoption, safety behavior, and operating cost

Seeded people, prices, facilities, license references, field interviews, and locations are demo records unless independently verified. They must not be presented as official CPCB registrations or real field evidence.

## 14. License

This project is released under the [MIT License](LICENSE). The demo datasets, identities, authorization references, and field records remain illustrative and must be independently verified before operational use.
