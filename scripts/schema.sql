-- ====================================================================
-- KabadiLink PostgreSQL Schema
-- Target: PostgreSQL (Supabase / Neon)
-- Matches: 01-database-schema.md
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sequences for Human-Readable Identifiers
CREATE SEQUENCE IF NOT EXISTS lot_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS record_id_seq START 1;

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT UNIQUE NOT NULL,
    email TEXT,
    password_hash TEXT,
    role VARCHAR(20) NOT NULL CHECK (role IN ('COLLECTOR', 'RECYCLER', 'ADMIN')),
    preferred_language VARCHAR(5) NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'hi', 'mr')),
    is_adult BOOLEAN NOT NULL DEFAULT true,
    fcm_token TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. OTP CODES
CREATE TABLE IF NOT EXISTS otp_codes (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    code TEXT NOT NULL,
    delivery_channel VARCHAR(20) NOT NULL CHECK (delivery_channel IN ('DEV_LOG', 'EMAIL', 'WHATSAPP')),
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ
);

-- 3. COLLECTORS
CREATE TABLE IF NOT EXISTS collectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. RECYCLERS
CREATE TABLE IF NOT EXISTS recyclers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    materials_accepted TEXT[] NOT NULL DEFAULT '{}',
    pickup_available BOOLEAN NOT NULL DEFAULT false,
    service_area_km DOUBLE PRECISION NOT NULL DEFAULT 25.0,
    cpcb_reg_number TEXT,
    authorization_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (authorization_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    reliability_score DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. VERIFICATION DOCUMENTS
CREATE TABLE IF NOT EXISTS verification_documents (
    id BIGSERIAL PRIMARY KEY,
    recycler_id UUID NOT NULL REFERENCES recyclers(id) ON DELETE CASCADE,
    doc_url TEXT NOT NULL,
    doc_type TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. MATERIALS
CREATE TABLE IF NOT EXISTS materials (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name_en TEXT NOT NULL,
    name_hi TEXT,
    name_mr TEXT,
    category TEXT NOT NULL
);

-- 7. LOT PHOTOS (Supports Multi-item Detection)
CREATE TABLE IF NOT EXISTS lot_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collector_id UUID NOT NULL REFERENCES collectors(id) ON DELETE CASCADE,
    raw_photo_url TEXT NOT NULL,
    phash TEXT,
    detections_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    lot_group_id UUID,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. LOTS
CREATE TABLE IF NOT EXISTS lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_code TEXT UNIQUE NOT NULL,
    collector_id UUID NOT NULL REFERENCES collectors(id) ON DELETE CASCADE,
    material_id INT REFERENCES materials(id),
    lot_photo_id UUID REFERENCES lot_photos(id),
    lot_group_id UUID,
    weight_kg DOUBLE PRECISION NOT NULL,
    condition TEXT NOT NULL,
    photo_url TEXT,
    hazard_flags TEXT[] NOT NULL DEFAULT '{}',
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('DRAFT', 'OPEN', 'OFFERED', 'ACCEPTED', 'HANDOVER_PENDING', 'COMPLETED', 'DISPUTED', 'CANCELLED')),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. PRICE ESTIMATES (Explainable Fair Price)
CREATE TABLE IF NOT EXISTS price_estimates (
    id BIGSERIAL PRIMARY KEY,
    lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
    min_price DOUBLE PRECISION NOT NULL,
    max_price DOUBLE PRECISION NOT NULL,
    median_price DOUBLE PRECISION NOT NULL,
    confidence VARCHAR(10) NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
    explanation_text TEXT NOT NULL,
    source VARCHAR(20) NOT NULL CHECK (source IN ('local_model', 'cloud_verified', 'rule_based')),
    sample_size INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. PRICES (Market Observations)
CREATE TABLE IF NOT EXISTS prices (
    id SERIAL PRIMARY KEY,
    material_id INT NOT NULL REFERENCES materials(id),
    buying_price DOUBLE PRECISION NOT NULL,
    location TEXT NOT NULL,
    price_date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- 11. OFFERS (Multiple Offers with Counter-Offer)
CREATE TABLE IF NOT EXISTS offers (
    id BIGSERIAL PRIMARY KEY,
    lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
    recycler_id UUID NOT NULL REFERENCES recyclers(id) ON DELETE CASCADE,
    price DOUBLE PRECISION NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED', 'EXPIRED')),
    parent_offer_id BIGINT REFERENCES offers(id),
    proposed_by VARCHAR(20) NOT NULL CHECK (proposed_by IN ('RECYCLER', 'COLLECTOR')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. TRANSACTIONS (Canonical Source of Truth for Payments)
CREATE TABLE IF NOT EXISTS transactions (
    id BIGSERIAL PRIMARY KEY,
    lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
    offer_id BIGINT REFERENCES offers(id),
    amount DOUBLE PRECISION NOT NULL,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('CASH', 'DIGITAL')),
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. HANDOVERS (Safe Handover + Pickup Tracking)
CREATE TABLE IF NOT EXISTS handovers (
    id BIGSERIAL PRIMARY KEY,
    lot_id UUID UNIQUE NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'ACCEPTED', 'EN_ROUTE', 'READY_TO_VERIFY', 'COMPLETED', 'DISPUTED')),
    otp_code TEXT,
    otp_verified_at TIMESTAMPTZ,
    location_shared BOOLEAN NOT NULL DEFAULT false,
    actual_weight_kg DOUBLE PRECISION,
    transaction_id BIGINT REFERENCES transactions(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. DISPUTES (Handover Dispute Reporting)
CREATE TABLE IF NOT EXISTS disputes (
    id BIGSERIAL PRIMARY KEY,
    lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
    reported_by UUID NOT NULL REFERENCES users(id),
    type VARCHAR(30) NOT NULL CHECK (type IN ('WEIGHT_MISMATCH', 'PAYMENT_MISMATCH', 'DAMAGED', 'PICKUP_ISSUE')),
    description TEXT NOT NULL,
    evidence_photo_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED')),
    resolution_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- 15. EPR HANDOVER RECORDS (CPCB Form-2 Ready)
CREATE TABLE IF NOT EXISTS epr_handover_records (
    id BIGSERIAL PRIMARY KEY,
    lot_id UUID UNIQUE NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
    record_id TEXT UNIQUE NOT NULL,
    material_code TEXT NOT NULL,
    weight_kg DOUBLE PRECISION NOT NULL,
    recycler_authorization_id TEXT,
    handover_verified_at TIMESTAMPTZ NOT NULL,
    pdf_url TEXT,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. AUDIT LOG
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    ai_source VARCHAR(20) CHECK (ai_source IN ('local_model', 'cloud_verified', 'rule_based')),
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. NOTIFICATIONS (In-App Queue)
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    channel VARCHAR(20) NOT NULL DEFAULT 'IN_APP' CHECK (channel IN ('IN_APP')),
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. SAFETY CONTENT
CREATE TABLE IF NOT EXISTS safety_content (
    id SERIAL PRIMARY KEY,
    material_code TEXT NOT NULL,
    language VARCHAR(5) NOT NULL CHECK (language IN ('en', 'hi', 'mr')),
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('TEXT', 'AUDIO', 'ISL_VIDEO')),
    content_url TEXT NOT NULL
);

-- 19. PICKUP GROUPS
CREATE TABLE IF NOT EXISTS pickup_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recycler_id UUID NOT NULL REFERENCES recyclers(id) ON DELETE CASCADE,
    lot_ids UUID[] NOT NULL DEFAULT '{}',
    route_order_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. DATASET EXPORTS
CREATE TABLE IF NOT EXISTS dataset_exports (
    id BIGSERIAL PRIMARY KEY,
    export_type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    row_count INT NOT NULL DEFAULT 0,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ====================================================================
-- Day-One Performance Indexes
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_lots_collector ON lots(collector_id);
CREATE INDEX IF NOT EXISTS idx_lots_status ON lots(status);
CREATE INDEX IF NOT EXISTS idx_lots_lot_code ON lots(lot_code);
CREATE INDEX IF NOT EXISTS idx_offers_lot ON offers(lot_id);
CREATE INDEX IF NOT EXISTS idx_offers_recycler ON offers(recycler_id);
CREATE INDEX IF NOT EXISTS idx_offers_parent ON offers(parent_offer_id);
CREATE INDEX IF NOT EXISTS idx_handovers_lot ON handovers(lot_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_prices_material_date ON prices(material_id, price_date);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;

-- ====================================================================
-- Initial Seed: 9 Materials
-- ====================================================================
INSERT INTO materials (code, name_en, name_hi, name_mr, category) VALUES
('PCB', 'Printed Circuit Board', 'सर्किट बोर्ड', 'सर्किट बोर्ड', 'Electronics'),
('CABLE', 'Copper & Insulated Cables', 'तांबे की तार व केबल', 'तांब्याची वायर', 'Metals'),
('BATTERY', 'Lithium-ion & Lead-Acid Batteries', 'बैटरी', 'बॅटरी', 'Hazardous'),
('LCD', 'LCD & Flat Panel Displays', 'एलसीडी स्क्रीन', 'एलसीडी डिस्प्ले', 'Displays'),
('CRT', 'Cathode Ray Tube Glass', 'सीआरटी मॉनिटर ग्लास', 'सीआरटी ग्लास', 'Hazardous Glass'),
('MOTOR', 'Electric Motors & Pumps', 'इलेक्ट्रिक मोटर', 'इलेक्ट्रिक मोटर', 'Metals'),
('MAGNET', 'Rare Earth & Ferrite Magnets', 'चुंबक', 'चुंबक', 'Specialty Metals'),
('PLASTIC', 'E-Waste Polymers (ABS/HIPS)', 'ई-कचरा प्लास्टिक', 'प्लास्टिक', 'Polymers'),
('OTHER', 'Mixed/Unclassified E-Waste', 'अन्य ई-कचरा', 'इतर ई-कचरा', 'General')
ON CONFLICT (code) DO NOTHING;
