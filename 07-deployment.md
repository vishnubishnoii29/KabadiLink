# KabadiLink — Deployment & Reliability (07 of 9)

Every piece of this stack runs on a genuine free tier. Nothing here requires spending money.
**Zero-Cost Principle**: No feature may have a hard dependency on a service whose free availability
has not been verified immediately before implementation. Every external service must have a documented
zero-cost fallback.
The GitHub Student Developer Pack (DigitalOcean/Azure credit) is a documented fallback only —
see the bottom of this file — not the default path.

---

## Step-by-step deployment

### 1. Database & Storage — Supabase (Primary) with Neon (DB Fallback)
- Create a new Supabase project (primary target — persists indefinitely, provides both Postgres and
  Supabase Storage for media and docs, unlike Render's own free Postgres which expires after 30 days).
  Neon serves as a database-only fallback.
- Run the schema from `01-database-schema.md` via a migration tool (Alembic recommended).
- Enable Supabase Storage for `lot_photos.raw_photo_url`, `verification_documents.doc_url`,
  `safety_content.content_url` (ISL videos), and `dataset_exports.file_url`.
- Copy the connection string into `DATABASE_URL`.

### 2. Redis — Upstash
- Create a free Upstash Redis database.
- Copy the connection URL into `REDIS_URL`. Used for: WhatsApp conversation state, rate
  limiting, hot-read caching.

### 3. Backend — Render or Railway (free tier)
- Connect the GitHub repo, set the build/start command for the FastAPI app
  (`uvicorn main:app --host 0.0.0.0 --port $PORT`).
- Set environment variables (full list below).
- **Render 512MB RAM OOM Protection (MANDATORY)**: Render's free tier enforces a strict 512MB RAM limit.
  Importing heavyweight ML frameworks will immediately crash the API container.
  - Production `backend/requirements.txt` must **strictly exclude** `torch`, `torchvision`, `tensorflow`,
    `opencv-python`, and `weasyprint`.
  - Use lightweight runtime libraries only: `onnxruntime` (CPU build, uses ~40MB RAM), `pillow` (image cropping),
    `fastapi`, `uvicorn`, `psycopg2-binary`, and `reportlab` (PDF generation).
  - All model training occurs offline in Google Colab; the backend only loads the optimized `.onnx` files.
- **Immediately after first successful deploy**, confirm `GET /health` returns 200 from the
  public URL before doing anything else.

### 4. Keep-alive — GitHub Actions (do this before anything else relies on the backend being warm)

`.github/workflows/keep-alive.yml`:
```yaml
name: Keep backend warm

on:
  schedule:
    - cron: '*/10 * * * *'
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping backend health endpoint
        run: curl -sf https://YOUR-BACKEND-URL/health || echo "ping failed, non-fatal"
```
Replace `YOUR-BACKEND-URL` once step 3 is live. Leave this running continuously from that point
on — it costs nothing and protects every future testing session, not just the final demo.

**Cold Start Handling**: While the cron ping keeps the instance warm in most conditions, treat it as
a **best-effort keep-alive**. The web and mobile apps must gracefully handle potential cold start delays
on the first request with clear loading skeletons and appropriate timeout retries.

**Supabase 7-Day Inactivity Auto-Pause Prevention**:
Supabase free tier automatically pauses databases if no SQL queries are received for 7 consecutive days.
Because `GET /health` is intentionally dependency-free (no DB connection), it does NOT prevent Supabase
from sleeping.
- Add a dedicated database heartbeat endpoint `GET /health/db` that runs `SELECT 1;` against Postgres.
- In `.github/workflows/keep-alive.yml`, add a daily step (or run every 6 hours) that curls
  `https://YOUR-BACKEND-URL/health/db` so Supabase persists indefinitely without manual intervention.

Optional extra redundancy for demo week specifically: point a free UptimeRobot or
cron-job.org monitor at the same `/health` endpoint on a 5-minute interval.

### 5. Web — Vercel
- Connect the repo, set the build directory to `web/`, framework preset Vite.
- Set `VITE_API_BASE_URL` to the deployed backend URL.
- Update the backend's CORS allowed origins to include the Vercel URL.

### 6. CI — GitHub Actions

`.github/workflows/ci.yml`:
```yaml
name: CI

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install -r backend/requirements.txt
      - run: python backend/smoke_test.py
```
Extend `smoke_test.py` as new endpoints are added — every phase in `00-master-plan.md` should
add its checks here before being considered done.

### 7. Monitoring — Sentry (free tier)
- Add the Sentry SDK to the FastAPI app (`sentry_sdk.init(dsn=...)`), and to the Flutter and
  React apps if time allows.

### 8. Load testing
- Use k6 (free, open source) with a short script hitting `/lots`, `/ai/estimate-price`, and
  `/lots/{id}/recyclers` at increasing concurrency.
- Record comprehensive performance metrics: **concurrency, requests/sec, p50 latency, p95 latency, and error rate**.
  Record the maximum concurrent users the free-tier backend handles before latency degrades — this is the
  defensible benchmark you quote as your "scalable" evidence. Don't skip actually running this; a claimed
  number without a real test behind it doesn't hold up to a judge's follow-up question.

### 9. Mobile build
- Point `lib/core/config.dart` at the deployed backend URL.
- Build a release APK for the demo device; also keep a debug build available for the
  field-research usability session so you can iterate quickly on feedback.

### 10. WhatsApp
- Point the Meta webhook URL at the deployed backend's `/whatsapp/webhook`. Test end-to-end
  with a real device before the field-research usability session.

---

## Environment variables (master list)

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | backend | Supabase/Neon connection string |
| `REDIS_URL` | backend | Upstash connection string |
| `JWT_SECRET` | backend | generate with `openssl rand -base64 48` |
| `GEMINI_API_KEY` | backend | free-tier key, Flash models only |
| `WHATSAPP_VERIFY_TOKEN` | backend | for Meta webhook verification |
| `WHATSAPP_ACCESS_TOKEN` | backend | for sending replies |
| `OTP_DELIVERY_MODE` | backend | `dev_log` for development/demo; `email` or `whatsapp` for real delivery — never `sms` |
| `SENTRY_DSN` | backend, web, mobile | optional but recommended |
| `VITE_API_BASE_URL` | web | deployed backend URL |
| (mobile) `API_BASE_URL` constant | mobile | set in `lib/core/config.dart`, not an env var in the Flutter build unless you set up `--dart-define` |

---

## Reserved fallback: GitHub Student Developer Pack

Try the free-tier-plus-keep-alive approach first. If, and only if, testing shows it's
genuinely unreliable (not just "it would be nicer to not think about it"), the pack provides:
- **DigitalOcean App Platform credit** — deploy the backend there instead of Render/Railway;
  no sleep-after-inactivity behavior, paid for by credit rather than real money. No code changes
  needed, just a different deploy target.
- **Azure credit** — held in reserve, no current use planned.
- **GitHub Pro** — more Actions minutes for the CI/keep-alive workflows; worth activating
  regardless of whether the DigitalOcean fallback is ever used, since it's free and removes any
  risk of hitting Actions minute limits.

---

## Final deployment checklist
- [ ] `/health` returns 200 from the public backend URL
- [ ] Keep-alive workflow has run successfully at least once on schedule
- [ ] Web app loads and successfully calls the deployed backend (check browser network tab, not
      just that the page renders)
- [ ] Mobile app (release build) points at the deployed backend, not localhost
- [ ] WhatsApp webhook verified and tested end-to-end with a real message
- [ ] CI is green on the latest commit
- [ ] At least one load-test run completed, with a number recorded
- [ ] Sentry receiving events (trigger one intentional test error to confirm)
- [ ] All environment variables above are set on the actual deployed services, not just in a
      local `.env` file
