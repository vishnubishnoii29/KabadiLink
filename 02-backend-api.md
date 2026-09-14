# KabadiLink — Backend API & Services (02 of 9)

Every endpoint below follows: router (thin, parses request, calls service, returns response) →
service (business logic, the only place that touches `db.py`) → response. No business logic in
routers. Every response involving an AI decision uses the explanation contract from
`03-ai-ml-pipeline.md`: `{result, confidence, reasoning, source}`.

Auth: all endpoints except `/auth/*`, `/health`, and `/whatsapp/webhook` require a JWT via
`Authorization: Bearer <token>`, checked by the existing `get_current_user` / `require_role`
dependencies from `auth.py` (keep these, they already work).

---

## routers/auth.py → services (auth logic can stay in auth.py, it's already small and correct)
| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| POST | /auth/register | `{phone, password?, role}` | `{user_id}` | password optional if OTP-only |
| POST | /auth/otp/request | `{phone, delivery: DEV_LOG\|EMAIL\|WHATSAPP}` | `{requested: true}` | writes to `otp_codes`; DEV_LOG returns the code in the response body and logs it server-side (demo/dev only — see `07-deployment.md` for the flag that controls this) |
| POST | /auth/otp/verify | `{phone, code}` | `{token, user_id}` | issues JWT on match |
| POST | /auth/login | `{phone, password}` | `{token, user_id}` | existing password path, unchanged |
| POST | /auth/logout | — | `{ok: true}` | |
| GET | /auth/me | — | user profile | |

---

## routers/lots.py → services/lots.py
| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| POST | /lots/photo | multipart photo, lat?, lon? | `{lot_photo_id, phash, detections: [{bbox, material, confidence, source}]}` | runs Multi-item Detection; computes perceptual hash for duplicate detection; does **not** create lots yet |
| POST | /lots/from-photo | `{lot_photo_id, mode: SPLIT\|COMBINE, items: [{bbox_index, weight_kg, condition}]}` | `[{lot_id, lot_code, ...}]` | SPLIT creates one lot per detection; COMBINE creates one lot spanning all detections. Weights entered by user; GPS coordinates inherited from parent photo |
| POST | /lots | `{material_code, weight_kg, condition, photo_url, lat, lon}` | lot object (incl. `lot_code`) | manual path (no multi-item photo), e.g. from WhatsApp text-only flow. Weight entered by user |
| GET | /lots | query filters: status, material, collector_id | list | |
| GET | /lots/{lot_id} | — | full lot detail incl. `lot_code`, current price_estimate, offers, handover status | |
| PUT | /lots/{lot_id} | partial fields | updated lot | |
| DELETE | /lots/{lot_id} | — | `{ok:true}` | only if status = DRAFT or OPEN |
| GET | /pickup-groups | query: recycler_id? | list of pickup groups | Group Pickup routes |
| POST | /pickup-groups | `{lot_ids}` | pickup group object | generates route order and waypoints |

## routers/offers.py → services/offers.py, services/matching.py
| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| GET | /lots/{lot_id}/price-estimate | — | `{min, max, median, confidence, explanation, source, sample_size}` | Fair Price Intelligence & Prediction — see `03-ai-ml-pipeline.md` for the confidence-threshold rule |
| GET | /lots/{lot_id}/recyclers | — | ranked list w/ scores + reasons | existing `match_recyclers()`, material-compatibility hard filter already implemented — verify it |
| POST | /lots/{lot_id}/offers | `{price}` | offer object | `recycler_id` derived securely from JWT auth (eliminates IDOR); anomaly-checked against `services/anomaly.py` before saving |
| GET | /lots/{lot_id}/offers | — | list, newest-first, with anomaly flags | |
| POST | /offers/{offer_id}/counter | `{price}` | new offer row w/ `parent_offer_id` set | either party can counter; status of prior offer set to COUNTERED |
| POST | /offers/{offer_id}/accept | — | `{ok:true}`, triggers handover creation | |
| POST | /offers/{offer_id}/reject | — | `{ok:true}` | |

## routers/handover.py → services/handover.py, services/payments.py
| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| GET | /handover/{lot_id} | — | handover status + OTP state + transaction link | |
| POST | /handover/{lot_id}/otp/generate | — | `{otp_code}` | Safe Handover — generated server-side |
| POST | /handover/{lot_id}/otp/verify | `{code, actual_weight_kg?}` | `{ok:true}`, status → COMPLETED-pending-payment | Validated server-side; records verified weight for EPR record |
| POST | /handover/{lot_id}/stage-offline | `{actual_weight_kg}` | `{status: READY_TO_VERIFY}` | Offline mode stages handover intent; full completion requires server OTP verification |
| POST | /handover/{lot_id}/status | `{status: EN_ROUTE\|COMPLETED}` | updated handover | Pickup Tracking |
| POST | /handover/{lot_id}/payment | `{amount, method: CASH\|DIGITAL}` | transaction object | Writes canonical payment to `transactions` table, updates `handovers.transaction_id`, marks handover COMPLETED |
| GET | /passport/{lot_id} | — | full Scrap Passport: origin, photo, weight, GPS, timestamps, offers, payment, pickup status, handover history | |

## routers/disputes.py → services/handover.py (or a dedicated services/disputes.py)
| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| POST | /lots/{lot_id}/disputes | `{type, description, evidence_photo_url?}` | dispute object | sets lot/handover status to DISPUTED |
| GET | /disputes | query: status | list | admin view |
| POST | /disputes/{id}/resolve | `{resolution_note, status: RESOLVED\|DISMISSED}` | updated dispute | admin only; cascades lot/handover to COMPLETED if resolved or CANCELLED if dismissed |

## routers/recyclers.py → services/matching.py (self-service part)
| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| GET | /recyclers/{id} | — | profile | |
| PUT | /recyclers/{id} | `{materials_accepted?, pickup_available?, service_area_km?, cpcb_reg_number?}` | updated | Recycler self-service |
| POST | /recyclers/{id}/verification-docs | multipart or `{doc_url, doc_type}` | doc record, status PENDING | |
| GET | /recyclers/{id}/lots | — | lots this recycler has offered on / won | |
| GET | /recyclers/{id}/pickups | query: status? | list of active handovers/pickups | assigned pickups for recycler |

## routers/uploads.py → services/uploads.py (generic object storage)
| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| POST | /uploads/file | multipart file | `{file_url}` | uploads file to Supabase Storage bucket (verification docs, dispute evidence, ISL media) |

## routers/notifications.py → services/notifications.py
| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| GET | /notifications | — | list, unread-first | in-app database queue, polled by web/mobile clients |
| POST | /notifications/{id}/read | — | `{ok:true}` | |
| *(internal)* | — | — | — | `services/notifications.py` exposes `notify(user_id, type, payload)`, called by other services (offer accepted, handover completed, etc.) — not a public endpoint itself |

## routers/epr.py → services/epr.py
| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| GET | /lots/{lot_id}/epr-record | — | EPR-Ready Handover Record JSON (+ `pdf_url` if generated) | only available once handover status = COMPLETED and payment confirmed in transactions; pulls recycler's `authorization_status` and doc-verified status into the record |
| GET | /lots/{lot_id}/epr-certificate | — | (alias to /lots/{lot_id}/epr-record) | backwards-compatible route alias |

## routers/admin.py → services/admin.py
| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| GET | /admin/overview | — | platform stats | |
| GET | /admin/verification-queue | — | pending `verification_documents` | |
| POST | /admin/verification-docs/{id}/review | `{status: APPROVED\|REJECTED}` | updated doc, cascades to recycler `authorization_status` | |
| GET | /admin/audit-log | filters | list | |
| GET | /admin/impact-summary | — | `{total_weight_kg, income_uplift_pct, hazardous_practices_avoided_estimate}` | platform-wide impact summary |
| GET | /collectors/{id}/impact-summary | — | `{total_weight_kg, income_uplift_pct, personal_certificate_url}` | Tier 2 #7 Personal Collector Impact Certificate |
| POST | /admin/dataset-export | `{export_type}` | queues a background job (see `jobs/`), returns job id | Structured Dataset deliverable |
| GET | /admin/dataset-export/{id} | — | status + `file_url` when done | |

## routers/ai.py → services/classification.py, services/pricing.py
| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| POST | /ai/classify-material | multipart photo | `{result, confidence, reasoning, source}` per item detected | full pipeline detail in `03-ai-ml-pipeline.md` |
| GET | /ai/estimate-price | query: material, weight, location, condition | `{min, max, median, confidence, explanation, source}` | same shape as `/lots/{id}/price-estimate`, usable before a lot exists (e.g. WhatsApp flow asking "what's it worth" before committing) |
| POST | /ai/anomaly-check | `{material, offer_price, location, condition}` | `{status, reason, severity}` | existing engine, keep as-is |

## routers/whatsapp.py
Full conversation-state spec in `06-whatsapp-bot.md`. This router has exactly one public
endpoint (`POST /whatsapp/webhook`, verified via Meta's signature header) and internally calls
the same service functions listed above — it does not duplicate any business logic.

---

## Cross-cutting response conventions
- All timestamps: ISO 8601 UTC.
- All money values: numeric, no currency formatting in the API layer (format in the client).
- All list endpoints: support `?limit=&offset=` pagination, default limit 50.
- Every error: `{error: {code, message}}`, standard HTTP status codes.
- Every endpoint that changes state calls `helpers.audit(conn, user_id, event_type, entity_type, entity_id, ai_source=None, metadata={})` before returning.
